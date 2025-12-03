# Nebuchadnezzar Features

## Health & Readiness Dashboard
- **Stability**: stable
- **Description**: Single-screen ops view showing router health, balances, provider readiness, models, bids, and computed readiness score.
- **Properties**:
  - Polls `/healthcheck`, `/blockchain/balance`, `/blockchain/providers`, `/blockchain/models`, and provider bids for the primary provider.
  - Readiness score degrades if router is unhealthy, MOR balance below threshold, no models, or no active bids (rules configurable in Settings).
  - Color-coded cards for router status, MOR balance, models, and bids.
- **Test Criteria**:
  - [x] Changing Settings base URL updates subsequent polls.
  - [x] Readiness score changes when balance/models/bids are missing.
  - [x] Offline router shows clear error state without crashing the page.

## Router Detail
- **Stability**: stable
- **Description**: Detailed view of `/healthcheck`, Morpheus `/config`, and underlying Lumerin config (if available).
- **Properties**:
  - Shows version, uptime, mode/network fields if present.
  - Renders raw JSON payload for debugging.
- **Test Criteria**:
  - [x] Invalid config endpoint displays a readable error without breaking layout.
  - [x] Config values update after changing Settings URLs and refreshing.

## Providers / Models / Bids
- **Stability**: stable
- **Description**: Table of providers with expandable models and bids, highlighting the primary wallet.
- **Properties**:
  - Fetches `/blockchain/providers`, `/blockchain/models`, and `/blockchain/providers/{id}/bids` on expand.
  - Sorts primary wallet to the top; shows stakes and counts.
- **Test Criteria**:
  - [x] Expanding a provider loads bids once and caches them for that session.
  - [x] No providers returns a friendly empty state.

## Health Timeline
- **Stability**: stable
- **Description**: Rolling client-side log of health/balance/provider snapshots polled every ~15s (latest 200 entries).
- **Properties**:
  - Uses `useHealthPoller` hook; snapshots include status, MOR balance, and provider count.
  - Visual status pill derived from health + MOR threshold.
- **Test Criteria**:
  - [x] Timeline appends new entries on schedule without unbounded growth.
  - [x] Missing base URL shows instructional message.

## Settings & Local Overrides
- **Stability**: stable
- **Description**: Client-only settings UI persisted to `localStorage` to override base URL, auth, wallet, thresholds, and polling interval.
- **Properties**:
  - Displays env-derived defaults for reference.
  - Allows toggling readiness rules for score calculation.
- **Test Criteria**:
  - [x] Saving settings persists across reloads in the same browser.
  - [x] Reset restores env defaults.

## Planned / Future
- **Stability**: planned
- **Description**: Additional diagnostics (e.g., RPC status, contract stats) and optional model/bid management flows.
- **Properties**:
  - Extend types/API client to cover more Morpheus endpoints (per `/swagger/doc.json`).
  - Add lightweight charts for historical uptime/balance export.
- **Test Criteria**:
  - [ ] New endpoints wired through `lib/apiClient.ts` with typed responses.
  - [ ] Additional UI respects existing dark theme and readiness score rules.***
