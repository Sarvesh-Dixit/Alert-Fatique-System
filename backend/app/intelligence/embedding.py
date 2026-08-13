from __future__ import annotations

import numpy as np
from fastembed import TextEmbedding


def compute_similarity(vec1: list[float] | np.ndarray, vec2: list[float] | np.ndarray) -> float:
    """Compute cosine similarity between two embedding vectors."""
    v1 = np.array(vec1)
    v2 = np.array(vec2)
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    if norm1 == 0.0 or norm2 == 0.0:
        return 0.0
    return float(np.dot(v1, v2) / (norm1 * norm2))


class TraceEmbeddingEngine:
    """Helper class to convert log messages and error stack traces into embedding vectors."""

    _model: TextEmbedding | None = None

    @classmethod
    def get_model(cls) -> TextEmbedding:
        """Lazily initialize the TextEmbedding model."""
        if cls._model is None:
            # We use the default model "BAAI/bge-small-en-v1.5" which is lightweight and fast
            cls._model = TextEmbedding()
        return cls._model

    @classmethod
    def get_embedding(cls, text: str) -> list[float]:
        """Convert a text string into an embedding vector."""
        if not text:
            text = ""
        model = cls.get_model()
        # TextEmbedding.embed accepts an iterable of strings and returns an iterable of numpy arrays
        embeddings = list(model.embed([text]))
        return embeddings[0].tolist()

    @classmethod
    def embed_event(cls, event: dict) -> list[float]:
        """Convert log messages and error stack traces in an event into a single embedding vector."""
        parts = []
        message = event.get("message")
        if message:
            parts.append(str(message))

        # Check metadata for traceback/backtrace/stacktrace
        metadata = event.get("metadata") or {}
        for key in ("backtrace", "stacktrace", "exception_backtrace", "exception_stacktrace", "traceback"):
            if metadata.get(key):
                parts.append(str(metadata[key]))
                break

        text = "\n".join(parts).strip()
        return cls.get_embedding(text)

    @classmethod
    def compute_similarity(cls, vec1: list[float] | np.ndarray, vec2: list[float] | np.ndarray) -> float:
        """Compute cosine similarity between two embedding vectors."""
        return compute_similarity(vec1, vec2)
