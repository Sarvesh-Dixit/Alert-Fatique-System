"""Telemetry Highway OS monitoring agent.

Design principles (spec §3, §27):
  * READ-ONLY: no remote shell, no command execution, no file mutation.
  * Least privilege: only reads permitted telemetry per the org policy.
  * Local security: redaction before anything leaves the host.
  * Failure isolation: bounded local buffer + retry, never crashes the host.
  * Same highway: emits canonical events into the SAME gateway/pipeline.
"""

__version__ = "0.3.0"
