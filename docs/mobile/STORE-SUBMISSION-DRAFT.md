# Bawi Shopping Store Submission Working Draft

Apple-specific metadata, privacy answers, reviewer notes, screenshots, and the paid-account handoff are now maintained in [`APPLE-APP-STORE-PREPARATION.md`](APPLE-APP-STORE-PREPARATION.md) and `apps/mobile-customer/store.config.json`.

## Product positioning

- App name: Bawi Shopping
- Category: Shopping
- Scope: Browse products, search, wishlist, cart, account/preferences, notifications, manual Telebirr payment-receipt review, orders, seller application, catalog, and fulfillment tools.
- Default display currency: ETB; users may choose another display currency in Account settings.

## Draft reviewer notes

This app sells physical clothing and accessories. Customers transfer the displayed ETB order amount through Telebirr and upload a confirmation receipt; an administrator verifies it before the order is confirmed. No digital goods are sold and no payment credentials are entered in the app. Provide a disposable reviewer customer account and a separately approved disposable seller account.

## Assets and metadata still requiring owner input

- Google short description and Play-specific listing copy
- Final support and marketing URLs
- Public Privacy Policy URL
- Copyright owner text
- Final confirmation of age/content-rating answers against the live catalog
- Required screenshots captured from signed release builds on the requested device sizes
- App Review / Play reviewer credentials and testing instructions
- Apple privacy labels and Google Data safety form, checked against `PRIVACY-DATA-INVENTORY.md`
- Export-control, advertising-ID, and encryption declarations confirmed in the store consoles

Do not claim that checkout, delivery coverage, bank payments, refunds, or seller payouts are available until their production paths are enabled and tested.
