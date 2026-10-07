# Bawi product image standardization

## Existing behavior retained

The existing product-listing module owns moderation and the separately stored
`ai_preview_url`. Approved previews appear before original photos; only approved
URLs are returned by the public product endpoint. Existing manual admin preview
uploads remain available for products that have not entered the new workflow.
Once a workflow exists, use Image Studio rather than the legacy upload controls.
No original gallery, thumbnail, inventory, price, order or payment data is changed.

## New workflow

Seller mobile and web product detail screens include Bawi Image Studio. Select
separate front/back originals, optionally a detail photo, and fill category, color,
material, pattern, sleeves, neckline, length, fit and sizes. Source references must
belong to the authenticated seller's product gallery. Source requirements include
1024 pixels per side, full garment, one product, straight-on composition, neutral
background, even light, true color, no screenshots/filters/watermarks/text/borders,
no obstructions and minimal extreme folds.

The request saves a `validating` job and returns immediately. A Medusa scheduled
worker processes up to 20 oldest pending listings every minute. The external
validator must inspect actual image pixels and return APPROVED,
NEEDS_CORRECTION (with actionable reasons), or ADMIN_REVIEW for uncertain cases.
Only approved sources enter generation. A Bawi administrator can resolve uncertain
sources. Only one hero is requested. Pending generation is polled by the worker;
clients poll persisted progress every five seconds while working.

Generated images enter human review, never auto-publication. Sellers can compare
front/back originals with the generated preview, approve accuracy, regenerate, or
report a mismatch. Bawi admins make the final publication decision. Reporting a
mismatch withdraws an approved hero pending review. Customer mobile and web show
the translated AI disclosure; originals remain in the gallery. Generation failure
never changes the product's commerce approval status or blocks its original photos.

Workflow state is additive JSON on the existing product listing plus a pending
index. It records source references, attributes, validation, provider/model profile,
provider job ID, generated URL, human decisions, regeneration count and timestamps.
Important decisions/transitions use the existing audit-log module. Admin Image
Studio includes the latest 50 listing audit entries.

Mutations/worker processing share a per-listing Medusa lock. Repeated requests while
pending reuse the current job. Retry uses the SAME generation idempotency key, even
if a provider timeout happened after it accepted the request. Explicit regeneration
uses a new key and requires a human action; seller attempts are capped at three
regenerations/corrections per listing, after which admin assistance is required.
External errors are reduced to safe codes. Jobs time out after 24 hours; explicit
retry restarts the local timeout without changing the provider idempotency key.

## Required external setup (feature stays unavailable until configured)

1. Choose a vendor and deploy a server-side adapter implementing the gateway below.
   This repository supplies the real HTTP boundary, not a vendor account, a trained
   model, or a simulated production result. No selected vendor is assumed.
2. Supply a commercially licensed Bawi model profile and confirm its rights outside
   the app. The adapter must resolve this profile to the authorized reference.
3. Set these BACKEND-ONLY environment variables (never `EXPO_PUBLIC_*`):
   - `BAWI_IMAGE_PROVIDER_URL`: HTTPS adapter base URL, no credentials/query/hash.
   - `BAWI_IMAGE_PROVIDER_KEY`: adapter bearer credential.
   - `BAWI_IMAGE_MODEL_PROFILE`: licensed profile ID.
4. Run `medusa db:migrate` to apply `Migration20261006000000`, deploy the backend
   scheduled worker, and use the existing Redis locking provider for multiple
   backend instances. Configure outbound access only to the approved adapter.
5. Test the real vendor with approved garments, corrections, uncertain cases,
   mismatches, provider timeouts, permanent storage and billing before enabling it.

Without all configuration, requests fail closed and the UI explains unavailability;
sellers can continue normal original-photo product submission. No credentials or
provider setup were added to production by this code change.

## Adapter protocol

All requests use `Authorization: Bearer <server-key>` and a 20-second HTTP timeout;
redirects are refused. Return JSON. Long-running work must return promptly as a job.

- `POST /validate`, `Idempotency-Key: <workflow-id>:validate`:
  body `{ sources: {front, back, detail?, attributes}, minimumResolution: 1024,
  checks: [...] }`.
  Response `{status: "APPROVED" | "NEEDS_CORRECTION" | "ADMIN_REVIEW", reasons: string[]}`.
  Validation must fetch and inspect the originals; never trust seller declarations
  as proof of image quality. Treat ambiguous checks as ADMIN_REVIEW.
- `POST /generations`, `Idempotency-Key: <workflow-id>`:
  body `{sources, modelProfile, count: 1, style}`. Preserve garment color/cut/print,
  neckline/sleeves/fastenings/length/fabric/silhouette; use the consistent Bawi crop,
  background, light and composition. Atomically deduplicate by idempotency key and
  retain results for retries. Repeated requests MUST NOT spend credits twice.
- `GET /generations/<encoded-job-id>`:
  return the same generation result shape without creating work.
- Generation result: `{status: "pending", jobId}`, `{status: "failed", jobId}`, or
  `{status: "succeeded", jobId, imageUrl}`. `imageUrl` must be a durable HTTPS image
  stored separately from originals in approved storage, not an expiring vendor URL.
  Never return API credentials in URLs/reasons. Set retention/access terms with the
  vendor; do not transfer unrelated seller/customer data.

The provider interface can be replaced in `src/product-images/provider.ts` without
changing screens, moderation or jobs. Track provider billing by the persisted
workflow/job IDs and audit records; no dashboard cost estimates are fabricated.

## Verification and release boundaries

Unit tests cover source ownership, cross-seller endpoint isolation, validation
outcomes, pending/success/failure, same-key retries, explicit regeneration, seller
and admin approval, mismatch withdrawal, original preservation, missing configuration,
HTTPS response validation and safe error handling. Test providers exist only in Jest.
Real Postgres migration/integration and live vendor/device validation are separate
release checks; a passing unit suite does not substitute for them.
