"""Phase 2 intelligence layer.

Deterministic, fast, explainable noise-reduction pipeline:

    normalize -> fingerprint -> group (dedup) -> spike detect
    -> severity -> incident engine -> cooldown/notify -> correlate

No LLM is involved in the core filter. AI can later augment summaries and
root-cause hypotheses on top of these deterministic outputs.
"""
