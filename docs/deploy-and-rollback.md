# Deploy and rollback

The user authorized production deployment after testing on 2026-11-02. Authorization does not cover purchasing services, changing secrets/DNS, submitting real orders, deleting data or modifying customer records.

## Deploy the focused Worker patch

1. Run `npm run build` and `npm test`; require the full suite to pass. Run `node --check worker/worker.mjs`.
2. Record the current Worker deployment/version, settings, binding names/types, routes, cron and Pages canonical production deployment. Keep private configuration out of the public repository.
3. Recheck the current active version against that snapshot immediately before release. If someone else deployed meanwhile, inspect their code rather than overwriting it.
4. Upload a **version without deploying** using Cloudflare's Worker versions API and multipart metadata: `main_module=worker.mjs`, existing compatibility date/flags and usage model, and `keep_bindings` covering every existing binding type. Do not replace or rotate any secret. Include the repository commit SHA in annotations.
5. Read the uploaded version and compare all bindings and runtime config to the snapshot. Do not activate it if any binding/config differs unexpectedly.
6. Create a Worker deployment directing 100% traffic to the verified new version. Preserve the custom-domain route, disabled workers.dev endpoint and existing cron.
7. Read live `/api/automation/health`; require the expected version, unchanged configured payment methods and encryption status. Load `/smm` in the browser, require the helper/CSS/new SMM script, a confirmed read-only quote and useful validation errors. Do not submit a real order.
8. Confirm the original Pages canonical production deployment, routes and all binding names/types remain unchanged. Record exact IDs in the private handoff report.

## Isolated preview

Build with `npm run preview:bundle`. Upload `preview.bundle.mjs` as `_worker.js` to the **existing Pages project's non-main preview branch**, with an empty asset manifest and `_routes.json` including `/*`. Check the API returns `environment=preview` and the original canonical production deployment is unchanged. The preview handler ignores all environment bindings, routes every API to synthetic responses and has no real-provider fetch path. It must never be used as the production store.

## Rollback

For a Worker regression, create a new deployment pointing 100% to the recorded prior Worker version. This reverts code without restoring/deleting database data or changing secrets. Verify the health response and original Pages flow afterwards.

Pages production was not replaced by this patch, so no Pages rollback is normally required. Keep the prior successful Pages deployment available. A D1 Time Travel bookmark was recorded privately as a recovery reference; **do not restore D1 as a routine code rollback**, because that can erase later customer activity and requires separate approval.

## Remaining release qualification

This focused Worker release does not certify automatic payment activation, real-money checkout, SocialHub/BYShop fulfillment, or the original admin/private Pages Functions. Recover those sources/configuration and plan a separately authorized controlled test before promising complete end-to-end automation.
