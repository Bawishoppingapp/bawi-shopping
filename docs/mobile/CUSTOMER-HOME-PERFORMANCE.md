# Customer Home and tab responsiveness

## Findings

The October 9 TestFlight screenshot showed an oversized dark hero, large category tiles, a shipping banner, and an empty catalog represented by blank product cards.

Code inspection identified these avoidable delays:

- Home held a full-screen skeleton until categories, products, and shipping policy all settled. A slow shipping request delayed otherwise available catalog content.
- Each Home focus resolved every recently viewed product again to localize its title: up to 12 detail requests per visit, plus an asynchronous SecureStore read.
- Search requested categories on every discovery-screen focus, duplicating Home's category request.
- Wishlist requested data and replaced the entire screen with a spinner on every focus.
- Home eagerly mounted its editorial/masonry content in a ScrollView; the section memo also depended on new sliced arrays each render.

The existing tabs already retain visited screens. Auth, locale, currency, and cart provider values are memoized. SecureStore access is asynchronous; this inspection did not establish synchronous storage blocking or provider rerenders as the cause. Those mechanisms were not replaced speculatively.

A single parallel read-only probe of the documented production backend returned categories in 0.73 seconds, products in 0.91 seconds, and shipping policy in 0.73 seconds (all HTTP 200). Products were empty. This sample does not reproduce the reported severe delay or rule out intermittent backend cold starts or phone/network problems.

## Changes

- Render Home's greeting, search entry, and navigation immediately. Categories and products settle independently.
- Remove the hero and shipping banner, including Home's shipping-policy request. Shipping rules in checkout are unchanged.
- Use matching compact category buttons, consistent 16-point side margins, 12-point grid gutters, and fixed 4:5 product images. Preserve the width of an unpaired last card.
- Replace the mixed editorial/masonry layout with a virtualized two-column product list. Move recently viewed items below the main catalog.
- Replace the empty marketplace's large blank cards with one compact explanatory state. Use existing translation keys throughout.
- Share categories between Home and Search for five minutes, keyed by locale. Cache Home arrivals and localized recently viewed history for one minute; cache wishlist reads for 30 seconds, keyed by session and locale.
- Coalesce simultaneous identical requests and bound all new caches in memory. Do not persist new user data or cache transactional checkout/cart responses.
- Keep existing same-language content visible during refresh; preserve it if a refresh fails. Pull-to-refresh bypasses freshness. Home focus revalidates expired arrivals without hiding the screen.
- Invalidate wishlist caches after successful adds/removals and logout/account deletion. History writes invalidate localized history. Ignore responses from an older language/focus request.
- Preserve all five tabs; explicitly disable tab transition animation.

## Verification

- Customer app lint and TypeScript checks.
- All 21 customer test suites: 129 tests, including new coverage for request coalescing, expiry, forced refresh, failure retention, invalidation during in-flight requests, cache bounds, account/locale isolation, wishlist mutations, independent Home loads, and late language responses.
- Expo production JavaScript exports for iOS and Android; an additional web export.
- Actual iPhone 17 Pro simulator using the existing development binary and a local fixture API: Home empty and populated states, all five guest tabs, category-data reuse, and English/Spanish UI switching.
- Existing simulator binary logs an ExpoLinearGradient native-module warning and an account route warning. Home no longer uses the gradient hero. A newly built TestFlight binary still needs device validation.

## Delivery limitation

The local Expo account `bawishopping` cannot read the configured project `8d4d3c80-ce1f-4ac4-a7e4-2b4a2f91618c`, whose owner in app.json is `nnamdi01`. EAS returned `Entity Not Authorized`. No owner/project identifiers or credentials were changed. A new signed build and TestFlight submission require an account with access to that existing project. GitHub changes and JavaScript export validation alone do not update installed TestFlight apps.

Release-device launch time, frame rate, authenticated end-to-end behavior, and poor-network performance are not measured by the simulator fixture checks.
