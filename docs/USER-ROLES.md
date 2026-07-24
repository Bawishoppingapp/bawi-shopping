# Bawi Shopping — User Roles & Permissions

## 1. Actor types

Authentication (see [`ARCHITECTURE.md`](ARCHITECTURE.md) §4) recognizes three independent actor types. An identity in one actor type has no standing in another — a seller user's credentials do not work on the admin portal, and vice versa.

| Actor type | Portal | Identity table scope |
|---|---|---|
| Customer | Storefront | `customer` |
| Seller user | Seller portal | `seller_user` (belongs to exactly one `seller`) |
| Admin user | Admin portal | `admin_user` |

## 2. Roles

### 2.1 Guest (unauthenticated)

- Browse storefront, search, view product/category pages, view seller storefront pages.
- Add items to a session-based cart.
- Cannot check out without registering or logging in (checkout requires a customer identity so orders, returns, and reviews have an owner).

### 2.2 Customer

- Everything Guest can do, plus:
- Manage own profile and addresses.
- Complete checkout, view own order history and order/return status.
- Request returns on own delivered items.
- Leave reviews on own verified purchases.
- Flag content (products/reviews) for moderation review.

### 2.3 Seller Owner

The accountable individual/entity behind a `seller` record. Created at approval time as the first `seller_user` for that seller.

- Everything Seller Staff can do (see below), plus:
- Complete/manage Stripe Connect onboarding for the seller.
- Invite/remove other `seller_user`s and assign their roles.
- View seller-level payout history and change payout-relevant settings (e.g., default shipping options).
- The only seller-side actor who can request seller account changes that affect legal/financial standing (e.g., business details).

### 2.4 Seller Staff

Additional users under a seller account, scoped by an assigned role:

| Sub-role | Can do |
|---|---|
| Catalog Manager | Create/edit/publish/archive own seller's products, variants, pricing, inventory |
| Order Fulfiller | View own seller's `vendor_order`s, update fulfillment/shipping status, respond to returns |
| Seller Analyst | Read-only: seller's own reporting/dashboards |

Seller Staff can never invite other users, touch Stripe/payout settings, or view/act on another seller's data under any circumstance — this is enforced at the module-service layer, not only the UI (see [`SECURITY.md`](SECURITY.md)).

### 2.5 Admin

Platform staff. Can:

- Review and approve/reject seller applications.
- Suspend/reinstate sellers.
- Moderate products and reviews (approve/reject/remove, resolve flags).
- Configure category-level commission overrides.
- View platform-wide reporting.
- Read (not silently write) customer and seller data for support purposes — all such reads/writes are audit-logged.
- Read audit logs relevant to their own actions and escalations assigned to them.

Admin **cannot**: set a seller-specific commission override that bypasses the rate-precedence rules (see [`PAYMENTS.md`](PAYMENTS.md)), directly edit a seller's product content (can only unpublish/reject, preserving seller authorship), or directly move platform funds outside the payout workflow.

### 2.6 Super Admin

Everything Admin can do, plus:

- Manage other admin users (create/deactivate/assign roles).
- Set platform-wide default commission rate.
- Hard-delete a seller (irreversible; requires a distinct confirmation step and is always audit-logged with full before-state).
- Full, unfiltered audit log read access.

## 3. Permission matrix (representative actions)

| Action | Guest | Customer | Seller Staff | Seller Owner | Admin | Super Admin |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Browse/search storefront | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Check out | ❌ | ✅ (own cart) | ❌ | ❌ | ❌ | ❌ |
| Manage own product listings | — | — | ✅ (own seller) | ✅ (own seller) | ❌ (unpublish only) | ❌ (unpublish only) |
| View another seller's products/orders | ❌ | ✅ (public product pages only) | ❌ | ❌ | ✅ | ✅ |
| Approve seller application | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Complete Stripe onboarding for seller | — | — | ❌ | ✅ (own seller) | ❌ | ❌ |
| Set platform default commission rate | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Set category commission override | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Approve/reject product or review (moderation) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Request return | ❌ | ✅ (own order) | ❌ | ❌ | ✅ (escalation) | ✅ |
| Approve/deny return | ❌ | ❌ | ✅ (own vendor_order) | ✅ (own vendor_order) | ✅ (escalation) | ✅ |
| View seller payouts | ❌ | ❌ | ❌ (unless Analyst, read-only) | ✅ (own seller) | ✅ (read, support) | ✅ |
| Manage admin users | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Read audit logs | ❌ | ❌ | ✅ (own account's entries only) | ✅ (own account's entries only) | ✅ (scoped) | ✅ (full) |
| Hard-delete a seller | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## 4. Session model per app

- **Storefront:** customer session via HTTP-only secure cookie; guest cart tied to an unguessable session token, merged into the customer's cart on login.
- **Seller portal:** seller-user session via HTTP-only secure cookie; every authenticated request is scoped server-side to the session's `seller_id` — the frontend never sends a `vendor_id`/`seller_id` the server should trust as authoritative.
- **Admin portal:** admin-user session via HTTP-only secure cookie; step-up consideration (e.g., re-auth) for Super Admin-only destructive actions such as hard-deleting a seller, deferred to [`SECURITY.md`](SECURITY.md).

## 5. Authorization enforcement principle

Every module service method that reads or writes seller-scoped data takes the caller's identity/role from the authenticated request context — never from a client-supplied field — and injects the corresponding `vendor_id`/`customer_id` filter before touching the database. A request parameter that looks like it selects "which seller" or "which customer" is only ever used for Admin/Super Admin callers, and even then the access is logged. See [`SECURITY.md`](SECURITY.md) for the full enforcement model and threat list.
