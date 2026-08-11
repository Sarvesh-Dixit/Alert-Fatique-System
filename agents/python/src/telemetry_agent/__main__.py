"""Agent CLI:  th-agent enroll ...   |   th-agent run

Enrollment (one-time):
    th-agent enroll --endpoint http://host:8000 --device-id dev_xxx --token <enrollment-token>

Run the agent:
    th-agent run
"""
from __future__ import annotations

import argparse
import sys

from telemetry_agent import __version__
from telemetry_agent.agent import Agent
from telemetry_agent.client import enroll as do_enroll
from telemetry_agent.collectors import os_info
from telemetry_agent.config import AgentConfig


def _cmd_enroll(args) -> int:
    info = os_info()
    result = do_enroll(
        args.endpoint,
        args.device_id,
        args.token,
        {
            "hostname": info["hostname"],
            "operating_system": info["operating_system"],
            "os_version": info["os_version"],
            "agent_version": __version__,
        },
    )
    credential = result["device_credential"]
    config = AgentConfig(
        endpoint=args.endpoint,
        credential=credential,
        device_id=result["id"],
        hostname=info["hostname"],
        region=result.get("region"),
        policy=result.get("config", {}),
    )
    config.save()
    print(f"✓ Enrolled device {result['id']} ({info['hostname']}). Credential stored securely.")
    print("  Start monitoring with:  th-agent run")
    return 0


def _cmd_run(_args) -> int:
    config = AgentConfig.load()
    if not config.credential:
        print("Not enrolled. Run `th-agent enroll ...` first.", file=sys.stderr)
        return 1
    Agent(config).run()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="th-agent", description="Telemetry Highway OS agent")
    parser.add_argument("--version", action="version", version=__version__)
    sub = parser.add_subparsers(dest="command", required=True)

    p_enroll = sub.add_parser("enroll", help="Enroll this device using an enrollment token")
    p_enroll.add_argument("--endpoint", required=True)
    p_enroll.add_argument("--device-id", required=True)
    p_enroll.add_argument("--token", required=True)
    p_enroll.set_defaults(func=_cmd_enroll)

    p_run = sub.add_parser("run", help="Run the monitoring agent")
    p_run.set_defaults(func=_cmd_run)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
