"""Minimal Chrome DevTools Protocol client — stdlib only (no websockets pkg).

Provides just enough CDP to:
  1. Connect to a Chrome debug port
  2. Evaluate JavaScript on the active page
  3. Wait for page navigation
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import socket
import struct
import time
import urllib.request
from typing import Any, Optional


class CDPError(Exception):
    pass


class CDPClient:
    """Tiny CDP client over raw WebSocket (no external deps)."""

    def __init__(self, debug_port: int, timeout: float = 10):
        self.debug_port = debug_port
        self.timeout = timeout
        self._sock: Optional[socket.socket] = None
        self._msg_id = 0

    # ── Public API ──────────────────────────────────────────────

    def connect(self, target_url_pattern: str = "") -> None:
        """Connect to a Chrome tab's WebSocket debugger.

        If *target_url_pattern* is given, pick the first tab whose URL
        contains that substring.  Otherwise pick the first ``page`` target.
        """
        ws_url = self._pick_target(target_url_pattern)
        if not ws_url:
            raise CDPError("No suitable Chrome tab found")
        self._ws_connect(ws_url)

    def close(self) -> None:
        if self._sock:
            try:
                self._sock.close()
            except OSError:
                pass
            self._sock = None

    def send(self, method: str, params: dict | None = None) -> dict:
        """Send a CDP command and return the result."""
        self._msg_id += 1
        msg = {"id": self._msg_id, "method": method}
        if params:
            msg["params"] = params
        self._ws_send(json.dumps(msg))

        # Read responses until we get our ID
        deadline = time.time() + self.timeout
        while time.time() < deadline:
            data = self._ws_recv()
            if data is None:
                continue
            try:
                resp = json.loads(data)
            except json.JSONDecodeError:
                continue
            if resp.get("id") == self._msg_id:
                if "error" in resp:
                    raise CDPError(resp["error"].get("message", str(resp["error"])))
                return resp.get("result", {})
        raise CDPError(f"Timeout waiting for response to {method}")

    def evaluate(self, expression: str) -> Any:
        """Evaluate JavaScript and return the result value."""
        result = self.send(
            "Runtime.evaluate",
            {
                "expression": expression,
                "awaitPromise": True,
                "returnByValue": True,
            },
        )
        inner = result.get("result", {})
        if inner.get("subtype") == "error":
            raise CDPError(inner.get("description", "JS error"))
        return inner.get("value")

    def wait_for_navigation(self, timeout: float = 15) -> str:
        """Block until a frame navigated event, return the new URL."""
        self.send("Page.enable")
        deadline = time.time() + timeout
        while time.time() < deadline:
            data = self._ws_recv()
            if data is None:
                continue
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                continue
            # frameNavigated or frameStoppedLoading
            if msg.get("method") == "Page.frameNavigated":
                frame = msg.get("params", {}).get("frame", {})
                url = frame.get("url", "")
                if url:
                    return url
        raise CDPError("Timeout waiting for navigation")

    def get_url(self) -> str:
        """Get the current page URL."""
        result = self.send("Runtime.evaluate", {"expression": "location.href", "returnByValue": True})
        return result.get("result", {}).get("value", "")

    def wait_for_element(self, selector: str, timeout: float = 10) -> bool:
        """Poll until a CSS selector matches an element on the page."""
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                found = self.evaluate(f"!!document.querySelector('{selector}')")
                if found:
                    return True
            except CDPError:
                pass
            time.sleep(0.5)
        return False

    def click(self, selector: str) -> bool:
        """Click an element by CSS selector via JS .click()."""
        try:
            self.evaluate(
                f"(function() {{ var el = document.querySelector('{selector}'); "
                f"if (el) {{ el.click(); return true; }} return false; }})()"
            )
            return True
        except CDPError:
            return False

    def click_by_text(self, text: str, tag: str = "button,a,div[role=button]") -> bool:
        """Click the first element whose textContent contains *text*."""
        # Escape single quotes in text
        escaped = text.replace("'", "\\'")
        js = (
            f"(function() {{"
            f"  var els = document.querySelectorAll('{tag}');"
            f"  for (var i = 0; i < els.length; i++) {{"
            f"    if (els[i].textContent.trim().indexOf('{escaped}') !== -1) {{"
            f"      els[i].click(); return true;"
            f"    }}"
            f"  }}"
            f"  return false;"
            f"}})()"
        )
        try:
            return bool(self.evaluate(js))
        except CDPError:
            return False

    # ── Target discovery ────────────────────────────────────────

    def _pick_target(self, url_pattern: str) -> Optional[str]:
        """Query /json endpoint and return the WebSocket debugger URL."""
        deadline = time.time() + self.timeout
        while time.time() < deadline:
            try:
                resp = urllib.request.urlopen(
                    f"http://127.0.0.1:{self.debug_port}/json",
                    timeout=3,
                )
                targets = json.loads(resp.read())
                for t in targets:
                    if t.get("type") != "page":
                        continue
                    if url_pattern and url_pattern not in t.get("url", ""):
                        continue
                    ws = t.get("webSocketDebuggerUrl")
                    if ws:
                        return ws
            except (urllib.error.URLError, OSError, json.JSONDecodeError):
                pass
            time.sleep(0.5)
        return None

    # ── Minimal WebSocket implementation ────────────────────────

    def _ws_connect(self, ws_url: str) -> None:
        """Perform WebSocket handshake over raw TCP."""
        # Parse ws://host:port/path
        assert ws_url.startswith("ws://"), f"Expected ws:// URL, got {ws_url}"
        rest = ws_url[5:]
        slash = rest.index("/")
        host_port = rest[:slash]
        path = rest[slash:]
        if ":" in host_port:
            host, port_str = host_port.rsplit(":", 1)
            port = int(port_str)
        else:
            host, port = host_port, 80

        self._sock = socket.create_connection((host, port), timeout=self.timeout)
        self._sock.settimeout(0.5)  # non-blocking reads for recv

        # WebSocket handshake
        key = base64.b64encode(os.urandom(16)).decode()
        handshake = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {host_port}\r\n"
            f"Upgrade: websocket\r\n"
            f"Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            f"Sec-WebSocket-Version: 13\r\n"
            f"\r\n"
        )
        self._sock.sendall(handshake.encode())

        # Read handshake response
        response = b""
        deadline = time.time() + self.timeout
        while time.time() < deadline:
            try:
                chunk = self._sock.recv(4096)
                if not chunk:
                    break
                response += chunk
                if b"\r\n\r\n" in response:
                    break
            except socket.timeout:
                continue

        if b"101" not in response.split(b"\r\n")[0]:
            raise CDPError(f"WebSocket handshake failed: {response[:200]}")

    def _ws_send(self, text: str) -> None:
        """Send a text frame (client must mask)."""
        payload = text.encode("utf-8")
        mask_key = os.urandom(4)

        # Build frame header
        header = bytearray()
        header.append(0x81)  # FIN + text opcode

        length = len(payload)
        if length < 126:
            header.append(0x80 | length)  # MASK bit set
        elif length < 65536:
            header.append(0x80 | 126)
            header.extend(struct.pack(">H", length))
        else:
            header.append(0x80 | 127)
            header.extend(struct.pack(">Q", length))

        header.extend(mask_key)

        # Mask the payload
        masked = bytearray(
            b ^ mask_key[i % 4] for i, b in enumerate(payload)
        )

        self._sock.sendall(bytes(header) + bytes(masked))

    def _ws_recv(self) -> Optional[str]:
        """Read one text frame (non-blocking, returns None on timeout)."""
        try:
            # Read header (2 bytes minimum)
            header = self._recv_exact(2)
            if not header:
                return None

            opcode = header[0] & 0x0F
            masked = bool(header[1] & 0x80)
            length = header[1] & 0x7F

            if length == 126:
                ext = self._recv_exact(2)
                if not ext:
                    return None
                length = struct.unpack(">H", ext)[0]
            elif length == 127:
                ext = self._recv_exact(8)
                if not ext:
                    return None
                length = struct.unpack(">Q", ext)[0]

            mask_key = b""
            if masked:
                mask_key = self._recv_exact(4)
                if not mask_key:
                    return None

            payload = self._recv_exact(length)
            if not payload:
                return None

            if masked:
                payload = bytes(
                    b ^ mask_key[i % 4] for i, b in enumerate(payload)
                )

            if opcode == 0x08:  # Close frame
                return None
            if opcode == 0x09:  # Ping → send pong
                self._sock.sendall(b"\x8a\x00")
                return None
            if opcode == 0x01:  # Text frame
                return payload.decode("utf-8", errors="replace")
            return None

        except socket.timeout:
            return None
        except OSError:
            return None

    def _recv_exact(self, n: int) -> Optional[bytes]:
        """Read exactly n bytes from the socket."""
        data = bytearray()
        deadline = time.time() + self.timeout
        while len(data) < n and time.time() < deadline:
            try:
                chunk = self._sock.recv(n - len(data))
                if not chunk:
                    return None
                data.extend(chunk)
            except socket.timeout:
                continue
        return bytes(data) if len(data) == n else None
