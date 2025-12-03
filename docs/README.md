# Morpheus / Lumerin reference notes

Collected upstream material to understand how Morpheus and the Lumerin proxy-router interact.

- `lumerin-proxy-router-README.md` – official Lumerin proxy-router README (health, config, miners, contracts endpoints).
- `lumerin-seller-prereqs.html`, `lumerin-validator.html` – Gitbook guides.
- `proxy-router-api-direct.md` – Morpheus doc that shows the `/blockchain/*` API surface (wallet, balance, models, providers, approve, swagger).
- Morpheus releases with `/blockchain` APIs: https://github.com/MorpheusAIs/Morpheus-Lumerin-Node/releases (e.g., v5.7.0, assets like `linux-x86_64-morpheus-router-5.7.0`).

Key API calls from `proxy-router-api-direct.md` (expected by this dashboard):
- `GET /wallet` – returns router wallet address.
- `GET /blockchain/models` – models and providers.
- `GET /blockchain/providers` – provider list.
- `GET /blockchain/balance` – MOR/ETH balances for the router wallet.
- `POST /blockchain/approve?spender=…&amount=…` – approve spend.
- Swagger: `http://<router-host>:8082/swagger/index.html`.

Tip: Use a Morpheus router build (not the Lumerin-only proxy-router) so the `/blockchain/*` endpoints are available.***
