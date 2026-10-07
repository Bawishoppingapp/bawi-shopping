# Apple App Store Preparation — Bawi Shopping

Last updated: 2026-09-28

This is the operational handoff for the first iOS release. Code and metadata preparation may be completed before purchasing Apple Developer Program membership. Signing, TestFlight distribution, and App Store submission require the paid account and must wait for the owner.

## Prepared in the repository

- App name: **Bawi Shopping**
- Bundle identifier: `com.bawishopping.mobilecustomer`
- Version: `1.0.0`; EAS owns and automatically increments the iOS build number.
- Phone-only portrait app (`supportsTablet: false`), avoiding an unsupported iPad experience and iPad screenshot requirement.
- Non-exempt encryption declaration: `false`.
- Photo-library explanation covers seller product photos and customer payment receipts.
- No camera, microphone, contacts, location, or tracking permission is requested.
- Apple privacy manifest explicitly declares no tracking and aggregates required-reason APIs used by React Native and installed Expo modules.
- Production EAS profile creates a store-distribution build and validates that the bundle points to a public HTTPS backend. The required public backend URL and publishable client key are configured in the EAS `production` environment.
- App Store metadata is prepared in `apps/mobile-customer/store.config.json` for later EAS Metadata upload.
- Primary category: Shopping. Secondary category: Lifestyle.
- Release is intentionally manual after Apple approval.

## App Store listing copy

The upload-ready English (U.S.) title, subtitle, description, promotional text, keywords, categories, and initial age-rating answers live in `apps/mobile-customer/store.config.json`.

Before syncing metadata, add the following after their public URLs are confirmed:

- Optional `marketingUrl`
- Optional `privacyChoicesUrl` (the in-app account deletion flow may be used instead)
- Copyright in the form `2026 <registered person or company name>`

The required URLs are already verified and included:

- Privacy: `https://bawi-shopping-storefront.vercel.app/legal/privacy`
- Support: `https://bawi-shopping-storefront.vercel.app/support`

Do not replace them with an unverified or broken URL. Apple requires the privacy URL, and the support URL must lead to real contact information.

## App Review notes

Use the following as the first-review notes, updating any details that change:

> Bawi Shopping is a marketplace for physical clothing and accessories. It does not sell digital goods or unlock digital features, so Apple In-App Purchase is not used. At checkout, customers see an exact ETB total, transfer that amount using Telebirr, and upload the transfer confirmation. An administrator verifies the payment before the physical order is confirmed. No card or Telebirr credentials are entered in the app.
>
> The seller tools are part of the same app. Sellers apply for approval, upload product information and photos, and manage fulfillment. Listings are reviewed by Bawi administrators before customers can purchase them.
>
> A customer reviewer account and a separately approved seller reviewer account are provided in the dedicated App Review credential fields.

Do not submit while the production backend can take roughly a minute to wake. App Review must receive a responsive service; upgrade Render or move the backend to an always-on host before selecting the build for review.

Never put passwords inside this repository or the review-notes field. Enter the disposable reviewer credentials only in App Store Connect's username/password fields.

## App Privacy answers

Confirm these against the final production providers immediately before submission. Current code and backend behavior support the following disclosure:

### Data linked to the user

| Apple data type | Examples in Bawi | Purpose |
|---|---|---|
| Contact Info — Name | Customer/seller name | App functionality |
| Contact Info — Email Address | Login, resets, support | App functionality; account management |
| Contact Info — Phone Number | Delivery and seller contact | App functionality |
| Contact Info — Physical Address | Saved delivery/business address | App functionality |
| Financial Info — Payment Info | Telebirr reference and uploaded confirmation receipt | App functionality; payment verification |
| Purchases — Purchase History | Cart/order items, totals, returns, status | App functionality |
| User Content — Photos or Videos | Seller product photos and payment receipt images | App functionality |
| User Content — Other User Content | Product descriptions/translations | App functionality |
| Identifiers — User ID | Customer and seller identifiers | App functionality; account management |
| Identifiers — Device ID | Expo push token | App functionality (transactional notifications) |
| Diagnostics — Other Diagnostic Data | IP/server security logs and audit records | Security; fraud prevention; app functionality |

### Explicit negative answers

- No data is used to track users across other companies' apps or websites.
- No data is sold.
- No third-party advertising or advertising identifier is used.
- No precise or coarse location is collected.
- No contacts, health, fitness, microphone, browsing history, or search history is collected by the backend.
- Local language, appearance, currency, and recent-search preferences stay on the device.

## Screenshot capture plan

Capture at least six clean screenshots from the signed TestFlight candidate, with realistic approved products and no debug UI, personal email, real payment receipt, or secret value visible:

1. Animated Bawi onboarding / brand introduction
2. Home with categories and approved products
3. Search and category browsing
4. Product detail with ETB price
5. Wishlist or cart
6. Telebirr checkout explanation or order tracking
7. Seller storefront dashboard (optional seventh image)

Use an accepted 6.9-inch portrait size, preferably `1320 × 2868`, or another size listed by Apple at submission time. Apple permits one to ten screenshots and does not accept transparency.

## Remaining owner steps

1. Confirm the Apple Developer membership for team `59Z7RLUM56` remains active.
2. Confirm the existing App Store Connect record still uses bundle ID `com.bawishopping.mobilecustomer` and app ID `6819915197` (already configured as `ascAppId` in `eas.json`).
3. Confirm the EAS account has Apple credentials authorized for team `59Z7RLUM56`.
4. Confirm the registered copyright owner name.
5. Create disposable customer and approved-seller reviewer accounts.
6. Enter App Review contact name, email, and international-format phone number.
7. Complete Apple's current age-rating questionnaire and verify the draft's all-`NONE` answers still match every approved marketplace category.
8. Create an EAS production iOS build using Apple-managed signing credentials.
9. Upload to TestFlight, test on a physical iPhone, then capture final screenshots.
10. Re-check App Privacy against every enabled production provider.
11. Select the tested build and submit it manually for App Review.

## Commands for the signed build and TestFlight upload

From `apps/mobile-customer`:

```sh
eas credentials --platform ios
eas build --platform ios --profile production
eas submit --platform ios --profile production
eas metadata:push
```

The first three commands require Apple account access and may create or use signing credentials. `eas submit` uploads to App Store Connect/TestFlight; it does not release the app publicly. Public release remains manual.
