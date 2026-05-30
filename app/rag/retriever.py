"""
Retriever: embed query -> hybrid search -> cross-encoder rerank -> top-N with metadata.
Returns citation-grade hits (document, revision, clause) for the orchestrator.
"""
from __future__ import annotations

from typing import Any

from app.config import get_settings
from app.rag.embeddings import Embedder
from app.rag.reranker import Reranker
from app.rag.vectorstore import VectorStore, _require_tenant_id


class Retriever:
    def __init__(self, store: VectorStore, embedder: Embedder | None = None,
                 reranker=None) -> None:
        self.store = store
        self.embedder = embedder or Embedder()
        self.settings = get_settings()
        self.reranker = reranker
        if self.reranker is None and self.settings.rerank_enabled:
            self.reranker = Reranker(
                model_name=self.settings.rerank_model,
                cache_dir=self.settings.rerank_cache_dir,
            )

    async def retrieve(self, query: str, *, tenant_id: str,
                       asset: str | None = None,
                       assets: list[str] | None = None) -> list[dict[str, Any]]:
        """
        ``assets`` (A9) is the asset_id plus its ancestors so a query about a
        single piece of equipment can still surface SOPs filed against the
        parent train/block/field. When ``assets`` is provided it takes
        precedence over the legacy ``asset`` single-value filter.
        """
        tenant_id = _require_tenant_id(tenant_id)
        [q_emb] = await self.embedder.embed([query])
        hits = await self.store.hybrid_search(
            tenant_id=tenant_id, query_text=query, query_embedding=q_emb,
            top_k=self.settings.retrieval_top_k,
            asset=asset, assets=assets,
        )
        if self.reranker and hits:
            hits = self.reranker.rerank(query, hits)
        return hits[: self.settings.rerank_top_n]
