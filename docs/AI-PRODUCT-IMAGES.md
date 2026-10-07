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
External errors are reduced to safe codes. Jobs time out after 24 hours. A known
provider job can be safely polled again; a submission with no saved provider job ID
must be reconciled before it can be retried or regenerated.

## Selected provider: FASHN Product to Model

The backend now calls FASHN's native `POST /v1/run` and `GET /v1/status/{id}` API
directly. It requests one 1k PNG using the `product-to-model` endpoint, sends the
front source photo and a configured licensed face-reference asset, then polls the
provider job. A successful base64 result is immediately uploaded to Bawi's Medusa
file provider; only that durable Bawi URL is stored and shown for review. The vendor's
temporary output URL is never published or saved.

FASHN lists Product to Model as Preview. It has no API for automatically checking
source garment completeness, image quality, watermarks, or product compliance, so
the adapter sends every source submission to Bawi admin review before any generation
credit is used. Admins must inspect both originals against the source-photo checklist
above. This is an explicit manual gate, not a fake automated verdict. FASHN API calls
do not document idempotency support; the worker records a submission marker before
the call and blocks retry/regeneration if a request may have been accepted but its job
ID was not saved. An admin must reconcile that case in the FASHN dashboard before
clearing/restarting it.

## Required external setup (feature stays unavailable until configured)

1. A Bawi account owner must review FASHN's current API and business terms, data
   processing terms, and Preview-stage stability, and select an API plan. FASHN says
   credits must be purchased before an API key can be created. No account, purchase,
   terms acceptance, or key was created by this code change.
2. Choose a model-reference image owned by Bawi or licensed for this commercial
   use, obtain any required model consent/release, and confirm rights to send it to
   FASHN. FASHN permits commercial use subject to the selected plan and rights to all
   uploaded content; it does not guarantee that outputs are unique or independently
   protected by IP. The operator must confirm these facts; the application cannot
   infer licensing from an environment variable.
3. Add the following as backend deployment secrets/configuration only. Never use
   `EXPO_PUBLIC_*`, mobile app config, or browser-visible variables:
   - `BAWI_IMAGE_PROVIDER_KEY`: FASHN API key.
   - `BAWI_IMAGE_MODEL_PROFILE`: Bawi's internal ID for the approved commercial model.
   - `BAWI_IMAGE_FACE_REFERENCE_URL`: stable HTTPS URL to its authorized reference;
     no credentials, query string, or fragment. Keep the asset access-controlled and
     make it fetchable by FASHN without exposing unrelated seller/customer data.
4. Apply `Migration20261006000000` to the target database, deploy the backend release
   (including the `bawi-product-images` every-minute scheduled job), and verify the
   configured shared Redis locking provider for multiple instances. The worker is
   part of the backend deployment; it is not a separate public endpoint.
5. Run a controlled real-account review with approved garments, invalid/corrected
   photos, ambiguous cases, mismatch rejection, generated image retention, billing,
   and mobile/web disclosure before enabling sellers at scale.

Until all three configuration values exist, generation fails closed and sellers can
continue with original photos and product submission. Test-only providers exist in
Jest; no test provider or simulated image is available in production.

## Provider contract details

All requests use `Authorization: Bearer <server-key>`, a 20-second timeout and
redirect refusal. FASHN's status endpoint reports `starting`, `in_queue`, `processing`,
`completed`, or `failed`. The adapter requests `return_base64: true` so the result can
be moved immediately into Bawi storage instead of relying on FASHN's three-day CDN
URL expiry. FASHN does not document idempotency for `/v1/run`; therefore ambiguous
submissions are not automatically repeated.

The provider can be replaced in `src/product-images/provider.ts` without changing
screens, moderation, or scheduled jobs. A replacement should add actual server-side
source analysis and documented idempotent submission before automating those steps.

## Verification and release boundaries

Unit tests cover source ownership, cross-seller endpoint isolation, validation
outcomes, pending/success/failure, same-key retries, explicit regeneration, seller
and admin approval, mismatch withdrawal, original preservation, missing configuration,
HTTPS response validation and safe error handling. Test providers exist only in Jest.
Real Postgres migration/integration and live vendor/device validation are separate
release checks; a passing unit suite does not substitute for them.
