# Mobile currency display — proposed approach (not yet built)

Per the user's explicit instruction, this is a proposal to review before any implementation, not a description of something already built. USD stays the transaction/settlement currency regardless of what's decided here — nothing below changes checkout, Stripe, tax, or payout logic.

## What this actually is

A **display-only** convenience: optionally show an approximate price in a customer's preferred currency next to the real USD price, e.g. `$54.00 (≈ 6,700 ETB)`. The real charge, the order record, the seller's payout — all of it stays USD, always. This is purely a "does this feel expensive to me" cue for the shopper, not a second currency the business ever holds or reconciles in.

## Recommended approach

**1. Rates come from the backend, not each phone.** A mobile client must never call an external FX API directly — with real usage that's N devices × M requests against a third-party rate limit, and it means every customer needs network access to a service Bawi doesn't control just to see a price. Instead: the *backend* fetches rates on a schedule (once every few hours is plenty — FX doesn't move fast enough for a shopping app to need live-to-the-second rates) and caches them. Mobile just asks Bawi's own backend for "today's rate," which is fast, free-tier-friendly, and works even if the upstream FX provider is briefly down (serve the last cached rate with an "as of" timestamp).

**2. Provider: start with a genuinely free, no-key tier.** [Frankfurter.app](https://frankfurter.app) (ECB rates, no API key, no rate limit that matters at this scale) or [open.er-api.com](https://open.er-api.com) (free, no key, daily updates) are both suitable for a cached-hourly-refresh use case — no paid service needed at current or near-term scale. Revisit only if a specific currency Bawi needs isn't covered, or if usage ever justifies a paid tier's better SLA (not likely for a long time).

**3. Minimal backend addition, not a redesign.** A small scheduled job (or simplest: compute lazily on first request per hour, cache in `business-config` or a tiny new table) storing `{base: "usd", rates: {etb: 123.4, eur: 0.92, ...}, fetched_at}`. One new read-only endpoint, `GET /currency-rates`, public, no auth. This is the one small, justified backend touch — everything else in this proposal is mobile-only.

**4. Mobile side.**
- A currency preference under Account → (next to Language), same pattern already built for language: a picker, persisted locally, defaulting to USD (no conversion shown until the customer opts in — don't assume everyone wants a second number).
- Fetch `/currency-rates` once per app session (or once per cache-staleness window), not per product card, not per screen.
- A small `formatApproxPrice(usdCents, rate)` utility, rendered as a clearly secondary, smaller, muted line under the real USD price — never the same size/weight as the real price, never without the "≈" and never without USD still visible. This is the "clearly approximate" requirement from the brief, enforced by how it's designed, not just a disclaimer string.
- If the rates fetch fails or is stale beyond some threshold (say 48h), just don't show the converted line at all rather than showing a wrong number — USD alone is always correct, so silently falling back to USD-only is the safe failure mode.

## What this deliberately does NOT do

- Does not change what currency a seller's inventory/pricing is entered in (still USD).
- Does not change checkout, Stripe, or payout currency.
- Does not attempt real-time/transactional-grade FX accuracy — this is a shopping-comfort feature, not a forex product.
- Does not add a paid FX subscription at current scale.

## Status

Not implemented. Recommend building once reviewed — small backend endpoint + mobile picker + display formatting, roughly the same size as the language-selector work already shipped.
