# WU-8: Custom REST API Explorer — Implementation Plan

## Overview
Build a full-featured REST API explorer within the Studio section. Users can craft HTTP requests, send them through a server-side CORS proxy, view responses with syntax highlighting, manage auth configs, and replay from history.

## Architecture

### Server-side proxy (`/api/studio/proxy`)
- POST endpoint accepting `{ url, method, headers, body? }`
- Auth gate: `getCredentialFromRequest()` must return non-null (any provider)
- Server performs the actual fetch, returns `{ status, statusText, headers, body, timeMs }`
- No SSRF protection beyond auth gate (red team tool — intentionally unrestricted)

### Client-side components
1. **Page** (`/studio/api-explorer/page.tsx`) — PanelGroup horizontal split
2. **RequestBuilder** — method select, URL, headers KV editor, body textarea, send button
3. **ResponseViewer** — status badge, timing, collapsible headers, pretty-printed body
4. **AuthConfig** — None / Bearer / API Key / Basic auth presets
5. **HistoryPanel** — localStorage-backed, 100-entry cap, click-to-replay

### Nav registration
- Add entry to `studioNavItems` with `Terminal` icon (need to register in icon-resolver.ts)

## Component Hierarchy
```
page.tsx
├── RequestBuilder (left panel)
│   ├── Method + URL bar
│   ├── AuthConfig (collapsible section)
│   ├── Headers KV editor
│   └── Body textarea
├── ResizeHandle
└── ResponseViewer (right panel)
    ├── Status + timing header
    ├── Response headers (collapsible)
    └── Response body (pretty-printed)
HistoryPanel (bottom collapsible)
```

## Files to create
1. `src/app/api/studio/proxy/route.ts`
2. `src/app/(studio)/studio/api-explorer/page.tsx`
3. `src/components/studio/api-explorer/request-builder.tsx`
4. `src/components/studio/api-explorer/response-viewer.tsx`
5. `src/components/studio/api-explorer/auth-config.tsx`
6. `src/components/studio/api-explorer/history-panel.tsx`

## Files to modify
1. `src/lib/studio/nav.ts` — add API Explorer nav item
2. `src/lib/icon-resolver.ts` — add `Terminal` icon

## Implementation order
1. Register Terminal icon + nav item
2. Create proxy API route
3. Create components (auth-config, request-builder, response-viewer, history-panel)
4. Create page
5. Build + test
