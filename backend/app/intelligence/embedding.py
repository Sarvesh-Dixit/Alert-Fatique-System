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


import threading
import logging

class TraceEmbeddingEngine:
    """Helper class to convert log messages and error stack traces into embedding vectors."""

    _model: TextEmbedding | None = None
    _use_fallback: bool = False
    _lock = threading.Lock()

    @classmethod
    def get_model(cls) -> TextEmbedding | None:
        """Lazily initialize the TextEmbedding model in a thread-safe manner."""
        if cls._use_fallback:
            return None
        if cls._model is None:
            with cls._lock:
                if cls._model is None and not cls._use_fallback:
                    try:
                        # We use the default model "BAAI/bge-small-en-v1.5" which is lightweight and fast
                        cls._model = TextEmbedding()
                    except Exception as e:
                        logging.getLogger("telemetry.api").error(
                            f"Failed to initialize TextEmbedding model, falling back to hashing: {e}"
                        )
                        cls._use_fallback = True
                        cls._model = None
        return cls._model

    @classmethod
    def warmup(cls) -> None:
        """Pre-warm the embedding model by triggering initialization and a dummy embed call."""
        logger = logging.getLogger("telemetry.api")
        logger.info("Pre-warming TraceEmbeddingEngine model in background thread...")
        try:
            model = cls.get_model()
            if model is not None:
                # Run a dummy inference to warm up ONNX runtimes/weights
                _ = list(model.embed(["warmup"]))
                logger.info("TraceEmbeddingEngine pre-warmed successfully.")
            else:
                logger.info("TraceEmbeddingEngine initialized using fallback vectorizer.")
        except Exception as e:
            logger.error(f"Error pre-warming TraceEmbeddingEngine, using fallback: {e}")
            cls._use_fallback = True
            cls._model = None

    @classmethod
    def get_fallback_embedding(cls, text: str, dimensions: int = 384) -> list[float]:
        """Generate a deterministic 384-dimensional vector using token hashing."""
        if not text:
            return [0.0] * dimensions
        vec = np.zeros(dimensions, dtype=np.float32)
        import re
        import hashlib
        tokens = re.findall(r"\w+", text.lower())
        if not tokens:
            tokens = list(text.lower())
        for token in tokens:
            h = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16)
            index = h % dimensions
            vec[index] += 1.0
        norm = np.linalg.norm(vec)
        if norm > 0.0:
            vec /= norm
        return vec.tolist()

    @classmethod
    def get_embedding(cls, text: str) -> list[float]:
        """Convert a text string into an embedding vector."""
        if not text:
            text = ""
        model = cls.get_model()
        if model is None:
            return cls.get_fallback_embedding(text)
        try:
            # TextEmbedding.embed accepts an iterable of strings and returns an iterable of numpy arrays
            embeddings = list(model.embed([text]))
            return embeddings[0].tolist()
        except Exception as e:
            logging.getLogger("telemetry.api").error(
                f"TextEmbedding inference failed, falling back to hashing vectorizer: {e}"
            )
            return cls.get_fallback_embedding(text)

    @classmethod
    def embed_event(cls, event: dict) -> list[float]:
        """Convert log messages and error stack traces in an event into a single embedding vector."""
        if "_trace_embedding" in event and event["_trace_embedding"] is not None:
            return event["_trace_embedding"]
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
