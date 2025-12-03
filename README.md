## Nebuchadnezzar: Local Morpheus / Lumerin Node Dashboard

Local-only Next.js + TypeScript + Tailwind dashboard to monitor and operate a Morpheus / Lumerin proxy-router running on a DGX Spark.

### Features
- Health/readiness dashboard with uptime, MOR balance, models, bids, and readiness score.
- Router detail view with `/healthcheck`, `/config`, and underlying Lumerin router config.
- Providers/models/bids explorer.
- Rolling health timeline (15s polling, stores latest 200 snapshots).
- Settings UI backed by `localStorage` to override base URL, auth, wallet, thresholds, and config endpoints.

### Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env defaults and edit if desired:
   ```bash
   cp .env.local.example .env.local
   # set NEXT_PUBLIC_MOR_PROXY_API_BASE=http://localhost:8082 (or your router)
   ```
3. Run the dev server:
   ```bash
   npm run dev
   ```
4. Open http://localhost:3000 on the DGX (or over your VPN). Visit **Settings** to confirm the proxy base URL, optional basic auth, wallet, and thresholds.

### Key Routes
- `/` – Ops dashboard with readiness score, balances, provider snapshot.
- `/router` – Health + `/config` payloads (Morpheus + underlying Lumerin router).
- `/providers` – Providers list with expandable models and bids.
- `/health-log` – 15s polling timeline for health/balance/providers.
- `/settings` – Local overrides for URLs, auth, wallet, thresholds, and polling interval.

### Notes
- API calls are client-side via `lib/apiClient.ts` using the configured base URL and optional basic auth.
- Readiness scoring rules are configurable; defaults require healthy router, MOR balance above minimum, at least one model, and one active bid.
- Data is local-only; nothing is persisted server-side. 
