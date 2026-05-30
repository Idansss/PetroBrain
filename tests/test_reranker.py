"""Reranker tests using fake models only."""
import asyncio
import os
import sys
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag import retriever as retriever_module
from app.rag.reranker import Reranker
from app.rag.retriever import Retriever


class FakeCrossEncoder:
    def __init__(self):
        self.calls = []

    def predict(self, pairs):
        self.calls.append(pairs)
        return [0.1, 0.9, 0.4]


class FakeEmbedder:
    async def embed(self, texts):
        return [[0.1, 0.2] for _ in texts]


class FakeStore:
    async def hybrid_search(self, **kwargs):
        return [
            {"id": 1, "text": "low relevance", "title": "A", "revision": "1", "clause": "1"},
            {"id": 2, "text": "highest relevance", "title": "B", "revision": "1", "clause": "2"},
            {"id": 3, "text": "middle relevance", "title": "C", "revision": "1", "clause": "3"},
        ]


class SpyReranker(Reranker):
    def __init__(self):
        super().__init__(model=FakeCrossEncoder())


def test_reranker_sorts_hits_by_cross_encoder_score():
    model = FakeCrossEncoder()
    reranker = Reranker(model=model)
    hits = [
        {"id": 1, "text": "low relevance"},
        {"id": 2, "text": "highest relevance"},
        {"id": 3, "text": "middle relevance"},
    ]

    out = reranker.rerank("flare emissions", hits)

    assert [row["id"] for row in out] == [2, 3, 1]
    assert out[0]["rerank_score"] == 0.9
    assert model.calls == [[
        ("flare emissions", "low relevance"),
        ("flare emissions", "highest relevance"),
        ("flare emissions", "middle relevance"),
    ]]


def test_retriever_default_reranker_reorders_before_truncating(monkeypatch):
    monkeypatch.setattr(
        retriever_module,
        "get_settings",
        lambda: SimpleNamespace(
            retrieval_top_k=12,
            rerank_top_n=2,
            rerank_enabled=True,
            rerank_model="fake-model",
            rerank_cache_dir="fake-cache",
        ),
    )
    monkeypatch.setattr(retriever_module, "Reranker", lambda model_name, cache_dir: SpyReranker())

    retriever = Retriever(FakeStore(), embedder=FakeEmbedder())
    hits = asyncio.run(retriever.retrieve("flare emissions", tenant_id="tenant-a"))

    assert [row["id"] for row in hits] == [2, 3]
    assert all("rerank_score" in row for row in hits)


def test_retriever_can_disable_default_reranker(monkeypatch):
    monkeypatch.setattr(
        retriever_module,
        "get_settings",
        lambda: SimpleNamespace(
            retrieval_top_k=12,
            rerank_top_n=2,
            rerank_enabled=False,
            rerank_model="fake-model",
            rerank_cache_dir="fake-cache",
        ),
    )

    retriever = Retriever(FakeStore(), embedder=FakeEmbedder())
    hits = asyncio.run(retriever.retrieve("flare emissions", tenant_id="tenant-a"))

    assert [row["id"] for row in hits] == [1, 2]
    assert all("rerank_score" not in row for row in hits)
