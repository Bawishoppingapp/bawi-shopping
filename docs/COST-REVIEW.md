# Infrastructure cost review

Answers the 12 cost questions from the original mobile-app review brief, against the architecture as it actually stands today: `GitHub` (source), `Render` (backend), `Supabase` (Postgres only — no Auth/Storage/SDK/RLS, per `docs/DECISIONS.md`), `Vercel` (web, currently paused), `Expo`/`EAS` (mobile), `Stripe` (test mode only). See `docs/DEPLOYMENT-LOWCOST.md` for the deployment mechanics behind the free-tier setup referenced throughout.

## 1. What can remain free while we develop?

Everything currently in use, and it already is:

- **GitHub** — free for a private repo at this scale.
- **Supabase** — free tier's 500MB Postgres + connection pooling is far beyond what pre-launch product/QA data needs.
- **Render** — free tier works for the backend today; the only real cost is cold starts (the instance sleeps after 15 min idle, ~30–60s to wake), which is a non-issue for a dev/staging environment nobody depends on being instantly responsive.
- **Vercel** — free Hobby tier while the web apps stay paused; even once resumed, Hobby covers pre-launch traffic fine (see `docs/DEPLOYMENT-LOWCOST.md`'s own note that Hobby is "fine for private validation with no real customers").
- **Expo Go** — the mobile app is developed and demoed entirely through Expo Go today; this costs nothing and needs no Expo account for anything built so far.
- **Stripe** — test mode is free indefinitely; no live keys exist anywhere in this codebase (`live_payments_enabled` etc. all default `false`).

## 2. What absolutely needs to become paid before real production?

In order of "must happen before the first real transaction," not before:

1. **Render, off the free tier** (Starter, ~$7/mo) — a real customer-facing backend can't sleep and wake with a 30–60s cold start on the first request of the day. This is the one non-negotiable paid upgrade.
2. **Stripe, live mode** — no cost until money actually moves (Stripe takes a per-transaction cut, not a subscription), but the account needs real business verification before `live_payments_enabled` can flip.
3. **A real transactional email provider** (`real_email_enabled` is currently `false`, notifications are log-only) — needed for order confirmations, password resets, seller approvals to actually reach anyone. Most providers (Postmark, Resend, SES) have a free tier that covers low volume, so this doesn't have to be paid on day one, but it does need a real account and API key before launch.
4. **A real object storage bucket** for product photos if still on Render's ephemeral local disk (Cloudflare R2's free 10GB tier, already wired in `medusa-config.ts`, covers this — free, but must be *provisioned*, not skipped, since local disk doesn't survive a redeploy).
5. **Apple Developer Program ($99/yr) + Google Play Console ($25 one-time)** — required to submit to either app store; nothing here runs without them once real users need an installable app instead of Expo Go.

## 3. Which paid upgrades should we delay until usage demands them?

- **Vercel Pro** — only needed once real vendor/customer traffic exceeds Hobby's limits or the team needs preview-deployment collaboration features; premature before launch.
- **Render Standard/Pro tiers (more RAM/CPU, autoscaling)** — Starter is enough for a single backend instance serving early real traffic; upgrade only when you can point at actual CPU/memory graphs justifying it.
- **Supabase Pro** — stay on free until the 500MB database or the free tier's connection-pooling limits actually bind, which for a marketplace's early traffic is a long way off.
- **EAS Build/Submit paid tiers** — the free tier's monthly build allowance is enough for infrequent release cadence; only upgrade if the team starts shipping multiple builds a day.
- **Redis** (any tier) — see question 8, this is a "usage demands it" item, not a "before launch" item.
- **A CDN in front of product images** beyond what R2/Vercel/Render already give you for free — revisit only once image bandwidth costs show up as a real line item (see question 9).

## 4. Are we paying for anything redundant?

No — nothing in the current stack duplicates another piece's job. Two things worth naming so they don't get *added* redundantly later: (a) don't add a second database (e.g. a Mongo/Firebase side-store) for anything mobile-specific — the wishlist and notification-inbox modules built this session both live in the same Postgres via Medusa's own module system, which is the right call; (b) don't add a caching layer before Redis is actually justified (question 8) — Render/Supabase's own free tiers already include reasonable connection pooling.

## 5. Can web + customer mobile + seller mobile safely share the same Medusa backend?

Yes, and they already do by design — `apps/mobile-customer` is a thin client hitting the exact same `store/*`/`seller/*`/`auth/*` REST routes the three Next.js apps call, with no mobile-specific backend code anywhere (`CLAUDE.md` rule 8). The former `apps/mobile-seller` was merged into `apps/mobile-customer` specifically to avoid running a fourth thing against the backend without adding real capacity need. One backend instance serving four frontends (storefront, seller-portal, admin, mobile) is exactly what "modular monolith, not microservices" (rule 1) means in practice — nothing here argues for splitting it.

## 6. Can they safely share the same PostgreSQL database?

Yes. Every table already carries proper tenant scoping (`vendor_id` on seller-owned rows, rule 2; authz enforced at the application layer, rule 3) — the isolation that matters is row-level, not database-level. Splitting into per-app databases would only add cross-database join/transaction pain (e.g. an order touching both `marketplace-order` and `seller-finance` tables) for zero real benefit at this scale.

## 7. What should trigger a future move to AWS?

Not a calendar date — concrete signals, any one of which is a legitimate reason to run `terraform apply` against the already-audited `infra/terraform/` (see `docs/DEPLOYMENT-LOWCOST.md`'s "Migrating back to AWS" section, which requires zero application code changes since every external dependency is env-var-driven):

- Render's paid tier's CPU/memory ceiling is being hit under real traffic, not just observed once.
- Supabase's connection-pooling limits start rejecting connections under normal (non-spike) load.
- A compliance/contractual requirement shows up that specifically needs AWS (e.g. a payment partner's infra requirement, a specific data-residency clause).
- The team needs infra capabilities Render/Supabase genuinely can't provide (custom VPC peering, dedicated compute for a background-job fleet, etc.) — not just "AWS is what real companies use."

Absent one of those, staying on Render/Supabase is the correct choice, not a temporary compromise — the project's own stated principle applies here directly: cost should grow because of real usage, not because AWS sounds more serious.

## 8. At what traffic/use level would Redis become justified?

`apps/backend/medusa-config.ts` already falls back to in-memory event bus/cache/locking when `REDIS_URL` is unset, which is *correct* behavior for a single backend instance — Redis has no job to do until there's more than one. It becomes justified the moment either of these becomes true, not before:

- **Horizontal scaling** — running more than one backend instance (for uptime or throughput), which needs a shared event bus/lock/cache across instances instead of each instance's own in-memory one.
- **Background job volume** grows enough to need a real queue instead of in-process workflow execution — Medusa's workflow engine handles the current scale fine without one.

Both Render (Redis add-on) and Upstash (free tier, serverless-friendly) just need a `REDIS_URL` value to activate — no code change, no provisioning-order dependency on anything else. There is no reason to add it pre-launch.

## 9. How should we minimize image/bandwidth cost?

- **`expo-image`** (already the only image component used throughout the mobile app) does disk caching by default — repeat views of the same product photo don't re-download it. This is already correctly in place, not a gap.
- **Product photo upload** should get a max-dimension/compression pass at upload time (seller product creation, `expo-image-picker`) rather than storing and repeatedly serving full-resolution originals — worth doing before real sellers start uploading, not after.
- **R2's free 10GB tier** (question 2) has no egress fee, unlike S3 — worth keeping as the object storage choice specifically for that reason once real product photo volume starts.
- **FlashList** (already adopted this session for Home/Search's product grids) only renders on-screen cells, which caps how many images are ever in memory/requested at once during a scroll — this was a real perf/bandwidth improvement, not just a UI nicety.

## 10. How should we prevent mobile apps from causing excessive backend requests?

Already well-behaved by construction, worth stating explicitly so it doesn't regress:

- Search's live-typing query is debounced (400ms, `apps/mobile-customer/src/app/(tabs)/search.tsx`) — not one request per keystroke.
- No screen polls — every list (orders, notifications, wishlist) refetches on focus (`useFocusEffect`) or explicit pull-to-refresh, never on an interval.
- The currency-display proposal (`docs/MOBILE-CURRENCY-DISPLAY.md`, not yet built) already specifies fetching FX rates once per session from the backend's own cache, never per-product-card or per-screen — worth holding that line if/when it's built.
- If real push notifications get built later (currently deferred — needs a custom dev client), that removes the only plausible future temptation to poll a notifications endpoint instead of using a real push.

## 11. Are any currently planned third-party services unnecessary?

Nothing currently in use is unnecessary. One thing to actively *not* add without a specific reason: a dedicated search service (Algolia, Elasticsearch, etc.) — `packages/search-contract`'s live-query Postgres adapter (`docs/DECISIONS.md`) is deliberately swappable for one later, but at current catalog size a paid search service would be pure cost with no user-facing benefit yet.

## 12. Are there cheaper architectural choices that don't require rewriting the Medusa backend?

Everything above already fits this constraint — none of it touches the backend's module/workflow structure. The only backend-adjacent recommendation from this review is R2 over S3 for object storage (question 9), which is a config choice already supported by the existing S3-compatible storage code, not a rewrite.

## Summary

Nothing here argues to add infrastructure. The stack is already about as lean as it can be for where the product is — the honest gaps are the pieces that don't exist *at all* yet (real email provider, real object storage bucket, Render off free tier), not pieces that need to be swapped for something more expensive. Redis, AWS, and a dedicated search service each have a specific, legible trigger condition above; none of those conditions are currently true.
