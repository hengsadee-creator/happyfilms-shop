# Happy Films recovery — 2026-11-02

User-authorized scope: recover the existing Cloudflare Pages/Worker system; improve API reliability and mobile checkout on an isolated branch; use mocks; provide a preview and tests; obtain approval before production. No live orders, money, secret/DNS changes, customer writes, paid services, or changes to heng-ai.

## Evidence and design

- Both named GitHub repositories have only README.md on main. No other branches were present.
- Pages is a direct-upload project with no Git source/commit mapping. Its server-side Functions source has not been recovered; do not invent its behavior or replace it.
- The deployed automation Worker was recovered completely. Keep the exact source on the backup branch; split embedded client strings into readable build inputs without changing the existing architecture.
- The custom domain passes through this Worker; pages.dev does not. Preserve routing and authentication policy.
- Payment credentials required by the automation code are absent; aggregate inventory and automation order/payment counts are zero. This is distinct from the existing manual Pages checkout.
- Existing SMM UI loads services and confirms a price. Supplier names contain HTML entities. The browser sends order POSTs without a timeout or duplicate-submission recovery.

## Plan

- [ ] Preserve deployed Worker and verify Git blob against recovered bytes. Keep database schema/bookmark private. No production data changes.
- [ ] Add Node built-in SQLite integration tests around the recovered Worker: exact cents, invalid quantities, repeated and concurrent request keys, changed payloads, provider timeout/429/auth/non-JSON, payment identity, foreign Origin and rate limits. Watch regressions fail before fixing.
- [ ] Preserve routes while adding strict money/input validation, atomic replay handling, bounded retry only for safe GETs, safe errors/request IDs, and preflight headers. Do not retry order-creating POSTs or release ambiguous payment reservations.
- [ ] Add a small shared browser helper; reuse recovered scripts. Improve accessible checkout feedback, busy/uncertain submission states, quantity and quote checks, readable supplier labels and mobile layout. A client key alone does not establish idempotency in the unrecovered Pages backend.
- [ ] Build a clearly labeled, isolated preview with synthetic catalogue/payment responses, no production DB/provider bindings and no real purchasing. Verify browser behavior and document viewport/testing limits.
- [ ] Run the complete test suite and a fresh review; publish a draft PR, deployment/rollback instructions and a private checkpoint. Production remains unchanged pending approval.

## Review focus

Zero/blank/fractional/oversized quantities; malformed decimal prices and integer overflow; same idempotency key used with changed intent; lost POST responses and concurrent submissions; unconfigured providers and direct pages.dev access.

## Acceptance and limits

Tests must demonstrate behavior against a real local SQLite schema, never production. Preview is a mocked UI/integration harness, not proof of live payment or supplier delivery. The Pages Functions source and a controlled production payment/supplier test remain release blockers. Costs and provider policy cannot be inferred from successful catalogue loading.
