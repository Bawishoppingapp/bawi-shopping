# Private Beta Physical-Device Test Plan

Run on at least one current and one older supported iPhone, plus one current and one older supported Android phone. Record app version/build, device, OS, account, timestamp, expected result, actual result, screenshot/video, and backend correlation ID where available.

## Installation and lifecycle

- Fresh install, first launch, splash screen, and permissions
- Background/foreground, force close/reopen, device restart, offline launch, and network recovery
- Upgrade from the previous beta without losing language, appearance, currency, session, wishlist, or cart

## Customer flows

- Guest Home, Search, categories, filters, product detail, images, and long translated copy
- Register, validation errors, login failure/success, logout, password reset delivery, and session expiry
- Password-reset email link opens the installed app with the code prefilled; the fallback code also works when pasted manually
- Language switch across every tab and nested screen; restart persistence
- Light/dark mode across every screen; restart persistence
- ETB default prices and optional display-currency conversion; restart persistence
- Wishlist add/remove, empty state, login boundary, and cross-device refresh
- Cart quantities, removal, totals, unavailable inventory, and checkout-disabled explanation
- Address create/edit/delete with Ethiopian and non-Ethiopian formats
- Notifications permission deny/allow, physical push delivery, read state, and deep-link destination
- Orders, order detail, cancellation/return states using seeded beta data
- Account deletion using a disposable account; confirm sign-out and backend removal

## Seller flows in the combined app

- Seller application, validation, restart/resume, admin approval, activation, and login
- Product draft creation, photo-library permission denied/allowed, image upload, translation, preview, and submission
- Staff, fulfillment, notification, and finance views with authorized/unauthorized roles

## Accessibility and resilience

- Large text, screen reader labels, contrast, keyboard behavior, reduced motion, and small screens
- Long Amharic, Tigrinya, Oromo, Spanish, and Chinese text in buttons/cards/modals
- Slow network, server error, expired session, duplicate tap, repeated request, and offline recovery
- No secrets, stack traces, internal seller/customer IDs, or another user's data exposed in UI or logs

## Exit criteria

- No crash, data-loss, authentication, privacy, or cross-account defect
- No severity-1 or severity-2 issue open
- Every supported language and theme completes the critical browse/account path
- Push tested on physical iOS and Android devices
- Signed preview build points only to staging HTTPS services
- Payment remains impossible in the beta build

## Deferred external gates

- Transactional email delivery remains log-only until the owner creates and verifies a SendGrid sender and stores a mail-send-only API key in the host secret manager. The reset-link code path is implemented; do not record delivery as passed until a real inbox test succeeds.
- Google Play Console submission remains deferred until the owner creates a developer account. The `play-internal` EAS profile may build an `.aab`, but no store submission or registration fee is authorized yet.
- Physical-iPhone distribution remains deferred until an Apple Developer membership and signing credentials are available. Continue iOS testing with the `preview-simulator` profile.
