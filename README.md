# HireHub

A browser-only careers-interest demo built with React 18, Vite, JavaScript/JSX, React Router v6 and one plain stylesheet. Home, Apply and Admin are client routes. There is no backend, API, database, analytics transmission or email flow.

## Run locally
Requires Node 24 and npm.

```sh
cd frontend
npm ci --no-bin-links
npm run dev -- --host 0.0.0.0
```
Default development port: 5173. Copy `.env.example` to `.env` to override the documented local port. Static frontend configuration is build-time; no secrets or API URLs are required.

```sh
npm test
NODE_ENV=production npm run build
npm run preview -- --host 0.0.0.0 --port 4173
node node_modules/@playwright/test/cli.js install chromium
PLAYWRIGHT_REUSE_SERVER=true npm run test:e2e
```
Node package-entry scripts work even when npm executable symlinks are disabled. Browser tests launch production preview automatically if no server is reused. To test an existing static server set `PLAYWRIGHT_BASE_URL` and `PLAYWRIGHT_REUSE_SERVER=true`.

## Demo behavior
Submit valid name, email, ten-digit mobile and one of eight departments on Apply. Records use exactly `{id, fullName, email, mobile, department, submittedAt}` at `localStorage['hirehub_submissions']`. Duplicate comparisons trim/lowercase email without changing the stored display value. Invalid input or failed persistence never reports success or clears input. Corrupted JSON/record shape recovers to an empty list; otherwise usable legacy string dates display N/A without erasing data.

Admin credentials are **admin / admin**, hardcoded by specification. The exact `sessionStorage['hirehub_admin_auth'] === 'true'` gate is tab-local presentation only, **not real authentication or authorization**. Anyone controlling the browser can inspect or bypass it. Admin shows this browser's records, validates editable fields, keeps email/ID/timestamp unchanged, and requires confirmation before deletion. Logout removes only the demo auth key.

Use synthetic data only. Contact details stay in that browser profile and are not sent to a hiring system. Clearing browser storage loses records. No backup, retention controls, centralized recruiting inventory or production privacy/security guarantees exist. Concurrent tabs may overwrite one another's changes.

## Static container / AWS handoff

```sh
docker build -t hirehub-static frontend
docker run --rm -p 8080:80 hirehub-static
```
The sole deployment component is `frontend/`, Dockerfile build context `frontend/`, nginx listening on all container interfaces at port 80. Root `/` returns 200; `/apply` and `/admin` fall back to the SPA entry document. The verified image uses Node build → nginx runtime, and candidate data never lives in container files. No compose/backend/database service is necessary.

The upstream AWS delivery path is CloudFront → shared ALB → frontend ECS service in shared VPC; CloudFormation/shared infrastructure belongs to the downstream deployment stage. No Vercel configuration is included because HLD/LLD supersede the older hosting preference. AWS deployment and standard-network p50/p95 release timings are not verified by this local development run.

## Verification and limitations
336 unit/component tests pass. All 52 desktop/mobile Playwright tests passed against both local preview and the actual nginx production container. Image build, nginx configuration and HTTP 200 at `/`, `/apply`, `/admin` passed. Browser screenshots, accessibility trees, computed styles and HTML are exported separately as `browser_evidence.zip` in the development handoff.

The independent test critic passed round 2 at 0.969231 with zero high failures. One medium coverage gap remains for a malformed UUID returned by the native generator; valid and throwing generation are covered. Two moderate npm audit advisories remain in mandated React Router v6; this app uses fixed internal links and no SSR hydration. Moving to v7 requires an architecture revision. All originally reported high/critical tooling findings were removed through pinned dependency upgrades. Review these residual warnings before any production expansion.
