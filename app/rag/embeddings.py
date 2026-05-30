"""Embedding provider abstraction (hosted for Tier A, self-hosted for Tier B)."""
from __future__ import annotations

from app.config import get_settings


class Embedder:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if self.settings.llm_provider == "self_hosted":
            return await self._self_hosted(texts)
        return await self._hosted(texts)

    async def _hosted(self, texts):
        from openai import AsyncOpenAI  # or any hosted embedding API
        client = AsyncOpenAI()
        resp = await client.embeddings.create(model=self.settings.embedding_model, input=texts)
        return [d.embedding for d in resp.data]

    def _self_hosted_base(self) -> str:
        # A single vLLM serves one model, so embeddings may be hosted separately
        # from chat; fall back to the chat endpoint when not configured.
        return self.settings.embedding_api_base or self.settings.llm_api_base

    async def _self_hosted(self, texts):
        import httpx
        async with httpx.AsyncClient(base_url=self._self_hosted_base(), timeout=60) as c:
            r = await c.post("/v1/embeddings",
                             json={"model": self.settings.embedding_model, "input": texts})
            r.raise_for_status()
            return [d["embedding"] for d in r.json()["data"]]
