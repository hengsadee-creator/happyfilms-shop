# Happyfilms — recovered automation Worker

Recovered from the existing deployed `happyfilms-automation` Worker on 2026-11-02. This repository preserves the current Pages/Worker architecture; it is not a replacement storefront.

## Source map

| Path | Purpose |
| --- | --- |
| `worker/backend.mjs` | Existing API, inventory/payment processing and origin proxy, with focused reliability fixes |
| `web/smm-app.js` | Recovered SMM storefront client, including existing checkout modal |
| `web/automation.js` | Existing automatic-stock storefront client |
| `web/transport.js` | Bounded safe reads, input validation and uncertain-submit guard |
| `web/recovery.css` | Incremental responsive/accessibility overlay |
| `web/stock-admin.*` | Existing stock administrator UI; no credentials are stored here |
| `tools/build.mjs` | Embeds readable assets into the original single-module deployment format |
| `worker/worker.mjs` | Built deployable Worker |
| `preview/`, `tools/build-preview.mjs` | Isolated UI harness using synthetic products/orders; never a production backend |
| `tests/` | Node 24 tests with local SQLite, actual checkout callbacks and mocked providers |
| `docs/` | Findings, progress, deployment and rollback |

```sh
npm run build
npm test
npm run preview:bundle
```

No npm dependencies or paid services are required for these build/test commands. Node 24 or newer is required for built-in SQLite.

The exact deployed baseline is preserved on `backup/automation-2026-11-02`, commit `a21812591d4ec56a8b0b67d80630426fb2a5e85e`.

## Important boundaries

The original Pages Functions server source has not been recovered. The existing live custom domain passes through the Worker; direct `pages.dev` access bypasses its patches. Do not claim legacy supplier fulfillment or server-side idempotency verified from the client alone. Payment credentials needed for automatic checkout are not configured, and its stock was empty when inspected. Preserve the existing manual workflow until those dependencies are intentionally configured and verified.

No real customer order, payment, secret change or database migration is part of the test suite or preview.
