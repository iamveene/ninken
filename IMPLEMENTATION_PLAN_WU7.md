# WU-7: Slack xoxc + d_cookie Team-Aware Correlation

## Problem
Multi-workspace Slack users have multiple xoxc tokens (one per workspace) and potentially
multiple d_cookies. The current `SlackCombinedCollector.collect()` naively pairs the first
d_cookie with ALL xoxc tokens, which is wrong for multi-workspace setups.

## LevelDB Key Format
Slack desktop stores tokens in LevelDB `*.log` files. The LevelDB key prefix contains the
origin URL which embeds the team ID:
- Key format: `https://app.slack.com_T01234ABCD` (team ID after the underscore)
- The xoxc token appears as the value associated with this key
- In the raw log file, the key context appears near the token in the byte stream

We can extract the team ID by looking at the bytes surrounding each xoxc token match for
a pattern like `_T[A-Z0-9]{8,11}` or `https://app.slack.com.*?(T[A-Z0-9]+)`.

## Changes

### 1. `slack/desktop.py` — `_extract_xoxc_tokens()` (standalone collector, unused by combined but update for consistency)
No changes needed here. The standalone `SlackDesktopCollector` is separate from the
`SlackCombinedCollector`. The combined collector has its own `_extract_xoxc_tokens()`.

### 2. `slack/combined.py` — `_extract_xoxc_tokens()`
- Change return type from `List[str]` to `List[Tuple[str, Optional[str]]]` — (token, team_id)
- For each xoxc match, scan a context window (512 bytes before the match) for:
  - `https://app.slack.com.*?(T[A-Z0-9]{8,11})` — Slack team ID in origin URL
  - Fallback: bare `(T[A-Z0-9]{8,11})` near the token
- If no team_id found, use None (backward compat)

### 3. `slack/combined.py` — `collect()`
- Group xoxc tokens by team_id using a dict: `{team_id: [tokens]}`
- For d_cookies, extract team_id from the cookie's `host` field (e.g., `.slack.com` —
  d_cookies are typically domain-wide, not team-specific)
- Actually, d_cookies from Chrome are per-domain (.slack.com), not per-team. The d_cookie
  is a single session cookie that works across all workspaces the user is logged into.
  So the correlation is: ALL xoxc tokens from the same browser session share the SAME d_cookie.

**Revised approach:** The real multi-workspace issue is when there are multiple Chrome profiles
(each with their own d_cookie) and the desktop app stores tokens for different profiles.
The d_cookie `host` field contains `.slack.com` (not team-specific). So:

- Group xoxc tokens by team_id for better labeling/identification
- If multiple d_cookies exist (from different profiles), try to determine which goes with which
  xoxc token — but since d_cookies are not team-scoped, the main win is:
  1. Adding team_id to CollectedToken extra metadata
  2. Logging which team each token belongs to
  3. For future: team_id enables targeted API calls

### 4. Helper: `_extract_team_from_context()`
- Takes the raw text and the match position
- Scans backwards in a context window for the team ID pattern
- Returns Optional[str]

## Implementation Order
1. Add `_extract_team_from_context()` helper
2. Update `_extract_xoxc_tokens()` return type
3. Update `collect()` to use team-aware grouping and add team_id to metadata
4. Log correlation results

## Testing
- `python3 -c "from ninloader.collectors.slack.combined import *; print('OK')"` must pass
- Types must be correct (no mypy errors at import time)
