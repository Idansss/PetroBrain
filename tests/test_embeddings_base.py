"""Embedder self-hosted base selection: PB_EMBEDDING_API_BASE wins, else falls
back to PB_LLM_API_BASE (Tier-B can host chat and embeddings separately)."""
import os
import sys
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.embeddings import Embedder


def _embedder(*, embedding_api_base: str, llm_api_base: str) -> Embedder:
    emb = Embedder()
    emb.settings = SimpleNamespace(
        embedding_api_base=embedding_api_base,
        llm_api_base=llm_api_base,
        embedding_model="m",
        llm_provider="self_hosted",
    )
    return emb


def test_dedicated_embedding_base_takes_precedence():
    emb = _embedder(embedding_api_base="http://vllm-embed:8000", llm_api_base="http://vllm:8000")
    assert emb._self_hosted_base() == "http://vllm-embed:8000"


def test_falls_back_to_chat_base_when_unset():
    emb = _embedder(embedding_api_base="", llm_api_base="http://vllm:8000")
    assert emb._self_hosted_base() == "http://vllm:8000"
