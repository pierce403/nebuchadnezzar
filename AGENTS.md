# AGENTS.md

Guidance for coding agents working on Nebuchadnezzar, a local-only Next.js dashboard for the Morpheus / Lumerin proxy-router.

## Project overview
- Stack: Next.js (App Router) + TypeScript + Tailwind CSS (v4). Client-side data fetching via `fetch` in typed helpers.
- Purpose: monitor a local Morpheus/Lumerin proxy-router, show health, balance, providers/models/bids, and readiness score; no auth layer, binds to localhost.
- Pages: `/` (dashboard), `/router`, `/providers`, `/health-log`, `/settings`.

## Setup commands
- Install deps: `npm install`
- Run dev server: `npm run dev`
- Lint: `npm run lint`
- Build: `npm run build`

## Environment
- Copy `.env.local.example` to `.env.local` for defaults.
- Key vars: `NEXT_PUBLIC_MOR_PROXY_API_BASE`, optional `NEXT_PUBLIC_MOR_PROXY_USERNAME` / `NEXT_PUBLIC_MOR_PROXY_PASSWORD`, `NEXT_PUBLIC_MOR_WALLET_ADDRESS`, `NEXT_PUBLIC_MIN_MOR_BALANCE`, `NEXT_PUBLIC_POLL_INTERVAL_MS`, and optional config URLs.
- Client-side settings overrides persist in `localStorage` via the Settings page.

## Code style
- TypeScript strict; prefer typed helpers in `lib/` and shared UI in `components/`.
- Keep edits ASCII; minimal comments unless clarifying complex logic.
- Tailwind utility-first styling; dark theme already set in `app/globals.css`.
- Use `apply_patch` for single-file edits when feasible; avoid destructive git commands.

## Testing
- Primary check: `npm run lint`.
- No automated unit tests yet; validate key flows manually by running dev server if changing data fetching or settings storage.

## API expectations
- Morpheus/Lumerin proxy-router endpoints used: `/healthcheck`, `/blockchain/balance`, `/blockchain/providers`, `/blockchain/models`, `/blockchain/providers/{id}/bids`, plus `/config` and optional underlying Lumerin config.
- All calls routed through `lib/apiClient.ts`; update types in `lib/types.ts` if responses evolve.

## UX notes
- Preserve single-screen ops feel on `/`; keep status colors (green/yellow/red) and concise cards.
- Avoid introducing auth or backend mutations unless explicitly requested.***
