// Package cdp implements a minimal Chrome DevTools Protocol client over raw
// WebSocket (no gorilla/websocket). It provides just enough CDP to connect to
// a Chrome debug port, evaluate JavaScript, and wait for navigation events.
//
// This is a direct port of ninloader/python/ninloader/core/cdp.py.
package cdp

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

// ErrCDP is returned for all CDP-level errors.
var ErrCDP = errors.New("cdp")

// Client is a minimal CDP client that communicates over a raw WebSocket.
type Client struct {
	debugPort int
	timeout   time.Duration
	conn      net.Conn
	msgID     int
}

// NewClient creates a CDP client targeting the given Chrome debug port.
func NewClient(debugPort int, timeout time.Duration) *Client {
	return &Client{
		debugPort: debugPort,
		timeout:   timeout,
	}
}

// Connect discovers a Chrome tab and performs the WebSocket handshake.
// If targetURLPattern is non-empty, the first tab whose URL contains that
// substring is selected; otherwise the first "page" target is used.
func (c *Client) Connect(targetURLPattern string) error {
	wsURL, err := c.pickTarget(targetURLPattern)
	if err != nil {
		return err
	}
	if wsURL == "" {
		return fmt.Errorf("%w: no suitable Chrome tab found", ErrCDP)
	}
	return c.wsConnect(wsURL)
}

// Close shuts down the underlying TCP connection.
func (c *Client) Close() {
	if c.conn != nil {
		_ = c.conn.Close()
		c.conn = nil
	}
}

// Send issues a CDP command and waits for the matching response.
func (c *Client) Send(method string, params map[string]any) (map[string]any, error) {
	c.msgID++
	msg := map[string]any{
		"id":     c.msgID,
		"method": method,
	}
	if params != nil {
		msg["params"] = params
	}

	payload, err := json.Marshal(msg)
	if err != nil {
		return nil, fmt.Errorf("%w: marshal: %v", ErrCDP, err)
	}
	if err := c.wsSend(payload); err != nil {
		return nil, err
	}

	// Read responses until we get our ID or timeout.
	deadline := time.Now().Add(c.timeout)
	wantID := c.msgID
	for time.Now().Before(deadline) {
		data, err := c.wsRecv()
		if err != nil {
			// Timeout on individual read is expected; keep trying.
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				continue
			}
			return nil, err
		}
		if data == nil {
			continue
		}

		var resp map[string]any
		if err := json.Unmarshal(data, &resp); err != nil {
			continue
		}

		// Check if this response matches our message ID.
		respID, _ := resp["id"].(float64)
		if int(respID) != wantID {
			continue
		}

		if errObj, ok := resp["error"]; ok {
			if m, ok := errObj.(map[string]any); ok {
				msg, _ := m["message"].(string)
				if msg == "" {
					msg = fmt.Sprintf("%v", errObj)
				}
				return nil, fmt.Errorf("%w: %s", ErrCDP, msg)
			}
			return nil, fmt.Errorf("%w: %v", ErrCDP, errObj)
		}

		result, _ := resp["result"].(map[string]any)
		if result == nil {
			result = map[string]any{}
		}
		return result, nil
	}

	return nil, fmt.Errorf("%w: timeout waiting for response to %s", ErrCDP, method)
}

// Evaluate runs a JavaScript expression and returns the result value.
func (c *Client) Evaluate(expression string) (any, error) {
	result, err := c.Send("Runtime.evaluate", map[string]any{
		"expression":    expression,
		"awaitPromise":  true,
		"returnByValue": true,
	})
	if err != nil {
		return nil, err
	}

	inner, _ := result["result"].(map[string]any)
	if inner == nil {
		return nil, nil
	}

	if subtype, _ := inner["subtype"].(string); subtype == "error" {
		desc, _ := inner["description"].(string)
		if desc == "" {
			desc = "JS error"
		}
		return nil, fmt.Errorf("%w: %s", ErrCDP, desc)
	}

	return inner["value"], nil
}

// WaitForNavigation blocks until a Page.frameNavigated event arrives or
// the timeout expires. Returns the new URL.
func (c *Client) WaitForNavigation(timeout time.Duration) (string, error) {
	// Enable Page domain events.
	if _, err := c.Send("Page.enable", nil); err != nil {
		return "", err
	}

	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		data, err := c.wsRecv()
		if err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				continue
			}
			return "", err
		}
		if data == nil {
			continue
		}

		var msg map[string]any
		if err := json.Unmarshal(data, &msg); err != nil {
			continue
		}

		method, _ := msg["method"].(string)
		if method == "Page.frameNavigated" {
			params, _ := msg["params"].(map[string]any)
			if params != nil {
				frame, _ := params["frame"].(map[string]any)
				if frame != nil {
					if url, _ := frame["url"].(string); url != "" {
						return url, nil
					}
				}
			}
		}
	}

	return "", fmt.Errorf("%w: timeout waiting for navigation", ErrCDP)
}

// GetURL returns the current page URL.
func (c *Client) GetURL() (string, error) {
	result, err := c.Send("Runtime.evaluate", map[string]any{
		"expression":    "location.href",
		"returnByValue": true,
	})
	if err != nil {
		return "", err
	}

	inner, _ := result["result"].(map[string]any)
	if inner == nil {
		return "", nil
	}
	url, _ := inner["value"].(string)
	return url, nil
}

// WaitForElement polls until a CSS selector matches an element on the page.
func (c *Client) WaitForElement(selector string, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		found, err := c.Evaluate(fmt.Sprintf("!!document.querySelector('%s')", selector))
		if err == nil {
			if b, ok := found.(bool); ok && b {
				return true
			}
		}
		time.Sleep(500 * time.Millisecond)
	}
	return false
}

// Click clicks an element by CSS selector via JS .click().
func (c *Client) Click(selector string) bool {
	js := fmt.Sprintf(
		"(function() { var el = document.querySelector('%s'); "+
			"if (el) { el.click(); return true; } return false; })()",
		selector,
	)
	_, err := c.Evaluate(js)
	return err == nil
}

// ClickByText clicks the first element whose textContent contains text.
// tag is a CSS selector for candidate elements (e.g. "button,a,div[role=button]").
func (c *Client) ClickByText(text, tag string) bool {
	escaped := strings.ReplaceAll(text, "'", "\\'")
	js := fmt.Sprintf(
		"(function() {"+
			"  var els = document.querySelectorAll('%s');"+
			"  for (var i = 0; i < els.length; i++) {"+
			"    if (els[i].textContent.trim().indexOf('%s') !== -1) {"+
			"      els[i].click(); return true;"+
			"    }"+
			"  }"+
			"  return false;"+
			"})()",
		tag, escaped,
	)
	result, err := c.Evaluate(js)
	if err != nil {
		return false
	}
	b, _ := result.(bool)
	return b
}

// ── Target discovery ──────────────────────────────────────────

// pickTarget queries the /json endpoint and returns the WebSocket debugger URL.
func (c *Client) pickTarget(urlPattern string) (string, error) {
	deadline := time.Now().Add(c.timeout)
	httpClient := &http.Client{Timeout: 3 * time.Second}

	for time.Now().Before(deadline) {
		resp, err := httpClient.Get(fmt.Sprintf("http://127.0.0.1:%d/json", c.debugPort))
		if err != nil {
			time.Sleep(500 * time.Millisecond)
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			time.Sleep(500 * time.Millisecond)
			continue
		}

		var targets []map[string]any
		if err := json.Unmarshal(body, &targets); err != nil {
			time.Sleep(500 * time.Millisecond)
			continue
		}

		for _, t := range targets {
			typ, _ := t["type"].(string)
			if typ != "page" {
				continue
			}
			if urlPattern != "" {
				url, _ := t["url"].(string)
				if !strings.Contains(url, urlPattern) {
					continue
				}
			}
			ws, _ := t["webSocketDebuggerUrl"].(string)
			if ws != "" {
				return ws, nil
			}
		}

		time.Sleep(500 * time.Millisecond)
	}

	return "", nil
}

// ── Minimal WebSocket implementation (RFC 6455) ───────────────

// wsConnect performs the HTTP Upgrade handshake over raw TCP.
func (c *Client) wsConnect(wsURL string) error {
	if !strings.HasPrefix(wsURL, "ws://") {
		return fmt.Errorf("%w: expected ws:// URL, got %s", ErrCDP, wsURL)
	}

	rest := wsURL[5:]
	slashIdx := strings.Index(rest, "/")
	if slashIdx < 0 {
		return fmt.Errorf("%w: malformed ws URL: %s", ErrCDP, wsURL)
	}
	hostPort := rest[:slashIdx]
	path := rest[slashIdx:]

	host := hostPort
	port := "80"
	if colonIdx := strings.LastIndex(hostPort, ":"); colonIdx >= 0 {
		host = hostPort[:colonIdx]
		port = hostPort[colonIdx+1:]
	}

	conn, err := net.DialTimeout("tcp", net.JoinHostPort(host, port), c.timeout)
	if err != nil {
		return fmt.Errorf("%w: dial: %v", ErrCDP, err)
	}

	// Generate random WebSocket key.
	keyBytes := make([]byte, 16)
	if _, err := rand.Read(keyBytes); err != nil {
		conn.Close()
		return fmt.Errorf("%w: rand: %v", ErrCDP, err)
	}
	wsKey := base64.StdEncoding.EncodeToString(keyBytes)

	handshake := fmt.Sprintf(
		"GET %s HTTP/1.1\r\n"+
			"Host: %s\r\n"+
			"Upgrade: websocket\r\n"+
			"Connection: Upgrade\r\n"+
			"Sec-WebSocket-Key: %s\r\n"+
			"Sec-WebSocket-Version: 13\r\n"+
			"\r\n",
		path, hostPort, wsKey,
	)

	if _, err := conn.Write([]byte(handshake)); err != nil {
		conn.Close()
		return fmt.Errorf("%w: handshake write: %v", ErrCDP, err)
	}

	// Read handshake response.
	_ = conn.SetReadDeadline(time.Now().Add(c.timeout))
	var response []byte
	buf := make([]byte, 4096)
	for {
		n, err := conn.Read(buf)
		if n > 0 {
			response = append(response, buf[:n]...)
		}
		if strings.Contains(string(response), "\r\n\r\n") {
			break
		}
		if err != nil {
			conn.Close()
			return fmt.Errorf("%w: handshake read: %v", ErrCDP, err)
		}
	}

	// Validate 101 Switching Protocols.
	firstLine := string(response[:strings.Index(string(response), "\r\n")])
	if !strings.Contains(firstLine, "101") {
		conn.Close()
		return fmt.Errorf("%w: WebSocket handshake failed: %s", ErrCDP, firstLine)
	}

	c.conn = conn
	return nil
}

// wsSend sends a text frame with client masking per RFC 6455.
func (c *Client) wsSend(payload []byte) error {
	maskKey := make([]byte, 4)
	if _, err := rand.Read(maskKey); err != nil {
		return fmt.Errorf("%w: mask rand: %v", ErrCDP, err)
	}

	var header []byte
	header = append(header, 0x81) // FIN + text opcode

	length := len(payload)
	switch {
	case length < 126:
		header = append(header, byte(0x80|length)) // MASK bit set
	case length < 65536:
		header = append(header, 0x80|126)
		lenBytes := make([]byte, 2)
		binary.BigEndian.PutUint16(lenBytes, uint16(length))
		header = append(header, lenBytes...)
	default:
		header = append(header, 0x80|127)
		lenBytes := make([]byte, 8)
		binary.BigEndian.PutUint64(lenBytes, uint64(length))
		header = append(header, lenBytes...)
	}

	header = append(header, maskKey...)

	// Mask the payload.
	masked := make([]byte, length)
	for i, b := range payload {
		masked[i] = b ^ maskKey[i%4]
	}

	frame := append(header, masked...)

	_ = c.conn.SetWriteDeadline(time.Now().Add(c.timeout))
	_, err := c.conn.Write(frame)
	if err != nil {
		return fmt.Errorf("%w: ws write: %v", ErrCDP, err)
	}
	return nil
}

// wsRecv reads one WebSocket message with fragment reassembly.
// Returns nil,nil on timeout or non-text frames (after handling ping/close).
func (c *Client) wsRecv() ([]byte, error) {
	var assembled []byte
	firstOpcode := byte(0)

	for {
		// Read 2-byte frame header.
		_ = c.conn.SetReadDeadline(time.Now().Add(500 * time.Millisecond))

		headerBuf := make([]byte, 2)
		if _, err := io.ReadFull(c.conn, headerBuf); err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				if assembled != nil {
					// We have partial fragments and timed out mid-message.
					continue
				}
				return nil, err
			}
			return nil, fmt.Errorf("%w: ws read header: %v", ErrCDP, err)
		}

		fin := headerBuf[0]&0x80 != 0
		opcode := headerBuf[0] & 0x0F
		masked := headerBuf[1]&0x80 != 0
		payloadLen := uint64(headerBuf[1] & 0x7F)

		// Extended payload length.
		if payloadLen == 126 {
			ext := make([]byte, 2)
			if _, err := io.ReadFull(c.conn, ext); err != nil {
				return nil, fmt.Errorf("%w: ws read ext16: %v", ErrCDP, err)
			}
			payloadLen = uint64(binary.BigEndian.Uint16(ext))
		} else if payloadLen == 127 {
			ext := make([]byte, 8)
			if _, err := io.ReadFull(c.conn, ext); err != nil {
				return nil, fmt.Errorf("%w: ws read ext64: %v", ErrCDP, err)
			}
			payloadLen = binary.BigEndian.Uint64(ext)
		}

		// Masking key (server frames are typically unmasked but handle both).
		var maskKey []byte
		if masked {
			maskKey = make([]byte, 4)
			if _, err := io.ReadFull(c.conn, maskKey); err != nil {
				return nil, fmt.Errorf("%w: ws read mask: %v", ErrCDP, err)
			}
		}

		// Payload data.
		payload := make([]byte, payloadLen)
		if payloadLen > 0 {
			if _, err := io.ReadFull(c.conn, payload); err != nil {
				return nil, fmt.Errorf("%w: ws read payload: %v", ErrCDP, err)
			}
		}

		// Unmask if needed.
		if masked {
			for i := range payload {
				payload[i] ^= maskKey[i%4]
			}
		}

		// Handle control frames immediately.
		if opcode == 0x08 { // Close
			return nil, nil
		}
		if opcode == 0x09 { // Ping -> Pong
			_ = c.conn.SetWriteDeadline(time.Now().Add(c.timeout))
			_, _ = c.conn.Write([]byte{0x8A, 0x00})
			return nil, nil
		}
		if opcode == 0x0A { // Pong (ignore)
			return nil, nil
		}

		// Track the opcode of the first fragment.
		if opcode != 0x00 { // Not a continuation frame.
			firstOpcode = opcode
			assembled = payload
		} else {
			// Continuation frame: append to assembled data.
			assembled = append(assembled, payload...)
		}

		if fin {
			// Message complete.
			if firstOpcode == 0x01 { // Text frame
				return assembled, nil
			}
			// Binary or other non-text — discard.
			return nil, nil
		}
		// FIN=0: more fragments coming, loop.
	}
}
