# Findings and evidence

## P1 — corrected in this patch

| Finding | Evidence | Correction |
| --- | --- | --- |
| Money parsing accepted hexadecimal/exponent notation and silently rounded excess decimals | Baseline tests accepted `0x10` and `1.005`; checkout produced `0.1+0.2=0.30000000000000004` | Decimal-only prices; integer satang arithmetic; reject unsafe totals |
| Zero/null/falsy quantity became one | `Number(b.quantity || 1)` in recovered createOrder; failing real SQLite tests | Explicit numeric integer 1–10 validation |
| Same request key accepted changed intent | Original replay checked only token | Match product, variant, quantity and private token; return 409 for changed intent |
| Concurrent request replay could fail after another request reserved stock | Parallel SQLite integration case failed on unique request key | Re-read the winning order after insert contention, preserving the atomic stock trigger |
| Transient provider reads failed immediately | Mocked 503 followed by valid charge remained 503 | At most three GET attempts, per-attempt timeout, exponential delay and jitter; honor Retry-After |
| Unknown order POST result could invite resubmission | Original client had unbounded fetch and no persistent unknown state | One bounded POST, persistent per-tab submission guard, inline status and manual reconciliation guidance |
| Null successful order response unlocked the new guard | Independent review and actual callback regression test | Reject null/primitive transport replies as uncertain; validate orderNo safely |
| Checkout modal bypassed strict quote checks | Independent review reproduced quantity mismatch and price `50.005` | Apply the same quantity/quote validator in the actual modal before enabling payment |
| Foreign Origins consumed rate-limit writes before rejection | Baseline database count increased for forbidden Origin | Origin validation first; explicit allowed-origin preflight and Retry-After |
| Internal failures appeared as HTTP 400 without correlation | Baseline database-failure test | HTTP 500 for unknown failures and opaque request IDs; log no credentials or customer payloads |
| Supplier labels exposed nested HTML entities | Real SMM page displayed `&amp;amp;` | Bounded entity decoding into text-only Option/textContent; never interpret provider markup |

## Operational dependencies and limits

- Pages and both named repositories: both repos originally contained only README and one main branch. Pages uses direct upload without a recorded Git commit. The recovered Worker is now backed up and maintainable here; original Pages Functions still need recovery from the original uploader/workspace.
- The existing Worker has D1, Workers AI, bundle config, INVENTORY_KEY, a custom-domain route and a one-minute cron. Its workers.dev endpoint is disabled. Existing settings/routes/schedules must be preserved.
- Required automatic payment credentials are absent. Aggregate automatic stock/orders/payments were all zero; the main product store had 3,871 product records. These counts do not prove supplier connectivity or fulfillment.
- Real read-only SMM quote returned JSON numeric quantity, THB currency, price 50 and provider min/max bounds for a published service. This proves that quote request only, not subsequent provider order creation or status reconciliation.
- The client names SocialHub TH, but the actual server adapter and its definitive API URL/documentation were not recovered. Do not substitute unrelated SocialHub API documentation. Do not send provider orders to test connectivity.
- Existing ambiguous payment/verification reservations remain held for reconciliation; this patch does not release potentially paid stock or retry a charge POST blindly.
- Direct pages.dev access bypasses the Worker. Making every hostname use the same patches requires the original Pages source or a separately approved routing/origin plan. No DNS change is included.
- Existing stock administrator routes remain authenticated against the original Pages admin API. No admin session or customer order data was accessed; the full administrator journey is not certified.

## External platform policy

Artificial follower/like services can violate the target platform's rules; engagement may be removed or accounts restricted. TikTok's official statement explicitly prohibits selling artificial engagement: https://newsroom.tiktok.com/how-tiktok-counters-deceptive-behaviour?lang=en-150 . The UI now discloses this risk; no permanent results or provider stability are guaranteed.

## Verification

Original Worker baseline: 12 passed / 14 failed. Final patch: 45 passed / 0 failed, including actual modal/callback regressions. Providers and payment responses are synthetic; SQLite uses the original relevant schema/triggers locally. The browser preview uses mock data with no DB bindings or provider fulfillment. See progress.md for browser checks and deployment evidence.
