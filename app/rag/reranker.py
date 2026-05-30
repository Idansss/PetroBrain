"""Cross-encoder reranking for citation-grade retrieval."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from app.config import get_settings


class Reranker:
    """
    Lazy-loaded cross-encoder reranker.

    The model is not imported or loaded at application startup. The first rerank call
    loads sentence-transformers and caches the model under the configured cache dir.
    Tests can inject a fake model with a compatible predict(pairs) method.
    """

    def __init__(self, model_name: str | None = None, cache_dir: str | None = None,
                 model: Any | None = None) -> None:
        settings = get_settings()
        self.model_name = model_name or settings.rerank_model
        self.cache_dir = cache_dir or settings.rerank_cache_dir
        self._model = model

    def rerank(self, query: str, hits: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not hits:
            return hits
        pairs = [(query, hit.get("text", "")) for hit in hits]
        scores = self._load_model().predict(pairs)
        scored = []
        for hit, score in zip(hits, scores):
            row = dict(hit)
            row["rerank_score"] = float(score)
            scored.append(row)
        return sorted(scored, key=lambda row: row["rerank_score"], reverse=True)

    def _load_model(self):
        if self._model is None:
            Path(self.cache_dir).mkdir(parents=True, exist_ok=True)
            from sentence_transformers import CrossEncoder

            self._model = CrossEncoder(self.model_name, cache_folder=self.cache_dir)
        return self._model
