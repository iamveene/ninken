<p align="center">
  <img src="images/ninken-banner.png" alt="Ninken Banner" width="100%">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-dc2626?style=flat-square&labelColor=1a1a1a" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-dc2626?style=flat-square&labelColor=1a1a1a" alt="License">
  <img src="https://img.shields.io/badge/Next.js-15-e6e6e6?style=flat-square&labelColor=1a1a1a" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-5-e6e6e6?style=flat-square&labelColor=1a1a1a" alt="TypeScript">
</p>

<p align="center">
  <b>Red Team Reconnaissance Toolkit for Cloud Services</b><br>
  <i>Track. Hunt. Retrieve.</i>
</p>

---

## What is Ninken?

Ninken (忍犬 — ninja dog) is a local-first red team reconnaissance platform for enumerating and auditing cloud service configurations. Drop in your OAuth credentials and get instant visibility into permissions, data exposure, and security posture.

## Features

- **Multi-Service Architecture** — Google Workspace today, Microsoft 365, GitHub, AWS next
- **Zero-Trust Local Storage** — Credentials encrypted in browser IndexedDB, never sent to third parties
- **Perpetual Access** — OAuth tokens auto-renew silently in the background
- **Audit Mode** — ROADtools-inspired permission enumeration for Google Workspace
- **Operate Mode** — Direct access to Gmail, Drive, Calendar, and more
- **Provider Registry** — Plug in new cloud services by implementing a single interface

## Quick Start

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

1. Navigate to `http://localhost:3000`
2. Select your target service
3. Drop your OAuth credential JSON
4. Start enumerating

## Architecture

```
src/
├── app/
│   ├── (google)/          # Google Workspace route group
│   ├── audit/             # Audit mode pages
│   ├── api/               # API routes
│   └── page.tsx           # Landing / auth page
├── components/            # UI components
├── hooks/                 # React hooks
└── lib/
    ├── providers/         # Service provider abstractions
    ├── token-store.ts     # Encrypted IndexedDB storage
    └── cache.ts           # Client-side caching
```

## Adding a Provider

1. Implement the `ServiceProvider` interface in `src/lib/providers/`
2. Register it in `src/lib/providers/index.ts`
3. Create a route group under `src/app/(provider-name)/`

## Security

Ninken is a red team tool designed for authorized security testing and research. Credentials are stored locally in encrypted IndexedDB and are never transmitted to external servers.

---

<p align="center">
  <img src="images/ninken-badge.png" alt="Ninken" width="48">
</p>
