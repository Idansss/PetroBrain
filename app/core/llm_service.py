"""
LLM service: a thin provider abstraction so Tier A (hosted frontier model) and
Tier B (self-hosted open-weights behind the OT DMZ) share one interface. Supports
streaming and tool/function calling. Network calls are isolated here.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, AsyncIterator

from app.config import get_settings


@dataclass
class LLMResponse:
    text: str
    tool_calls: list[dict[str, Any]]
    usage: dict[str, int]
    model: str


class LLMConfigurationError(RuntimeError):
    """Raised when the selected LLM provider cannot be called with current config."""


class LLMService:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def complete(
        self,
        system_prompt: str,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
    ) -> LLMResponse:
        provider = self.settings.llm_provider
        self._validate_provider_config(provider)
        if provider == "anthropic":
            return await self._anthropic(system_prompt, messages, tools)
        elif provider == "self_hosted":
            return await self._self_hosted(system_prompt, messages, tools)
        raise ValueError(f"unknown llm_provider {provider}")

    async def stream_complete(
        self,
        system_prompt: str,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """
        Stream LLM output as provider-neutral events.

        Yields ``{"type": "token", "text": ...}`` and one terminal
        ``{"type": "done", "text": ..., "tool_calls": ..., "usage": ..., "model": ...}``.
        """
        provider = self.settings.llm_provider
        self._validate_provider_config(provider)
        if provider == "anthropic":
            async for event in self._anthropic_stream(system_prompt, messages, tools):
                yield event
            return
        if provider == "self_hosted":
            async for event in self._self_hosted_stream(system_prompt, messages, tools):
                yield event
            return
        raise ValueError(f"unknown llm_provider {provider}")

    def _validate_provider_config(self, provider: str) -> None:
        if provider == "anthropic" and not os.getenv("ANTHROPIC_API_KEY"):
            raise LLMConfigurationError(
                "ANTHROPIC_API_KEY is required when PB_LLM_PROVIDER=anthropic"
            )
        if provider == "self_hosted" and not self.settings.llm_api_base:
            raise LLMConfigurationError(
                "PB_LLM_API_BASE is required when PB_LLM_PROVIDER=self_hosted"
            )

    async def _anthropic(self, system_prompt, messages, tools) -> LLMResponse:
        # Hosted frontier model (Tier A). Requires the anthropic SDK + key at runtime.
        from anthropic import AsyncAnthropic  # imported lazily

        client = AsyncAnthropic()
        kwargs: dict[str, Any] = {
            "model": self.settings.llm_model,
            "max_tokens": self.settings.llm_max_tokens,
            "system": system_prompt,
            "messages": messages,
        }
        if tools:
            kwargs["tools"] = [self._to_anthropic_tool(t) for t in tools]
        resp = await client.messages.create(**kwargs)
        text = "".join(b.text for b in resp.content if b.type == "text")
        tool_calls = [
            {"name": b.name, "input": b.input, "id": b.id}
            for b in resp.content if b.type == "tool_use"
        ]
        return LLMResponse(
            text=text,
            tool_calls=tool_calls,
            usage={"input": resp.usage.input_tokens, "output": resp.usage.output_tokens},
            model=resp.model,
        )

    async def _anthropic_stream(self, system_prompt, messages, tools) -> AsyncIterator[dict[str, Any]]:
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic()
        kwargs: dict[str, Any] = {
            "model": self.settings.llm_model,
            "max_tokens": self.settings.llm_max_tokens,
            "system": system_prompt,
            "messages": messages,
        }
        if tools:
            kwargs["tools"] = [self._to_anthropic_tool(t) for t in tools]
        chunks: list[str] = []
        async with client.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                chunks.append(text)
                yield {"type": "token", "text": text}
            final = await stream.get_final_message()
        text = "".join(chunks)
        tool_calls = [
            {"name": b.name, "input": b.input, "id": b.id}
            for b in final.content if b.type == "tool_use"
        ]
        if not text:
            text = "".join(b.text for b in final.content if b.type == "text")
        yield {
            "type": "done",
            "text": text,
            "tool_calls": tool_calls,
            "usage": {"input": final.usage.input_tokens, "output": final.usage.output_tokens},
            "model": final.model,
        }

    async def _self_hosted(self, system_prompt, messages, tools) -> LLMResponse:
        # Tier B: OpenAI-compatible endpoint (vLLM/TGI) hosted inside the customer
        # boundary so confidential data never leaves. No outbound public calls.
        import httpx

        payload = {
            "model": self.settings.llm_model,
            "messages": [{"role": "system", "content": system_prompt}, *messages],
            "max_tokens": self.settings.llm_max_tokens,
        }
        if tools:
            payload["tools"] = [{"type": "function", "function": t} for t in tools]
        async with httpx.AsyncClient(base_url=self.settings.llm_api_base, timeout=120) as c:
            r = await c.post("/v1/chat/completions", json=payload)
            r.raise_for_status()
            data = r.json()
        choice = data["choices"][0]["message"]
        tool_calls = [
            {
                "name": tc["function"]["name"],
                "input": _parse_tool_arguments(tc["function"].get("arguments", {})),
                "id": tc.get("id"),
            }
            for tc in choice.get("tool_calls", [])
        ]
        return LLMResponse(
            text=choice.get("content") or "",
            tool_calls=tool_calls,
            usage=data.get("usage", {}),
            model=data.get("model", self.settings.llm_model),
        )

    async def _self_hosted_stream(self, system_prompt, messages, tools) -> AsyncIterator[dict[str, Any]]:
        # OpenAI-compatible streaming varies across vLLM/TGI deployments. Stream text
        # deltas when available; otherwise callers can still use complete().
        import httpx

        payload = {
            "model": self.settings.llm_model,
            "messages": [{"role": "system", "content": system_prompt}, *messages],
            "max_tokens": self.settings.llm_max_tokens,
            "stream": True,
        }
        if tools:
            payload["tools"] = [{"type": "function", "function": t} for t in tools]
        chunks: list[str] = []
        async with httpx.AsyncClient(base_url=self.settings.llm_api_base, timeout=120) as c:
            async with c.stream("POST", "/v1/chat/completions", json=payload) as r:
                r.raise_for_status()
                async for line in r.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    raw = line.removeprefix("data:").strip()
                    if raw == "[DONE]":
                        break
                    data = json.loads(raw)
                    delta = data.get("choices", [{}])[0].get("delta", {})
                    text = delta.get("content") or ""
                    if text:
                        chunks.append(text)
                        yield {"type": "token", "text": text}
        yield {
            "type": "done",
            "text": "".join(chunks),
            "tool_calls": [],
            "usage": {},
            "model": self.settings.llm_model,
        }

    @staticmethod
    def _to_anthropic_tool(t: dict[str, Any]) -> dict[str, Any]:
        return {"name": t["name"], "description": t["description"], "input_schema": t["parameters"]}


def _parse_tool_arguments(arguments: Any) -> dict[str, Any]:
    if isinstance(arguments, dict):
        return arguments
    if isinstance(arguments, str):
        if not arguments.strip():
            return {}
        parsed = json.loads(arguments)
        if not isinstance(parsed, dict):
            raise ValueError("tool arguments JSON must decode to an object")
        return parsed
    raise TypeError(f"tool arguments must be a dict or JSON object string, got {type(arguments).__name__}")
