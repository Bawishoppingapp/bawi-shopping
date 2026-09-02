# Bawi Shopping — Design System

One shared system (`packages/ui`) powers the customer storefront, seller portal, and admin portal. The storefront is the most visually expressive of the three (fashion-forward, editorial); the seller portal and admin portal reuse the same tokens and components but favor density and clarity over editorial flourish. No app maintains its own divergent component library.

## 1. Design principles

- **Clean, modern, minimal, fashion-focused** — product imagery is the hero; UI chrome recedes.
- **Neutral color foundation** — color is used to signal state and hierarchy, not decoration.
- **Strong typography** — type does the work that decorative elements would otherwise do.
- **Generous spacing** — uncrowded layouts, especially around product imagery.
- **Consistency over novelty** — the same card, button, and form patterns everywhere across all three apps.

## 2. Color

- **Neutral palette** as the base: a grayscale/near-neutral ramp (e.g., off-white background, near-black text, a mid-gray scale for borders/secondary text) — no saturated brand color dominates the UI chrome.
- **One accent color**, used sparingly for primary actions (buy, submit, confirm) and active/selected states — not for decoration.
- **Semantic colors** for state, kept distinct from the accent: success (order confirmed, in stock), warning (low stock, action needed), error (payment failed, validation error), info (neutral status updates).
- Color is never the only signal for state — every semantic color pairs with an icon or text label (accessibility requirement, see §7).
- The web storefront and seller/admin portals stay light-only in v1. The native mobile app offers a saved Light/Dark preference because its full component palette is theme-aware; both modes preserve the same warm-neutral brand treatment and product-photo fidelity.

## 3. Typography

- One serif or high-contrast display face for editorial moments (homepage hero, category headers) paired with one clean sans-serif for UI text and body copy — two type families total, no more.
- A defined type scale (e.g., display, h1–h4, body-lg, body, body-sm, caption) shared as tokens across all three apps — no ad hoc font sizes.
- Line length and line height tuned for readability on product descriptions and long-form seller/admin tables alike.

## 4. Spacing & layout

- An 8px base spacing scale (4/8/12/16/24/32/48/64...), used consistently for padding, gaps, and section rhythm.
- Generous whitespace around product imagery and between sections on the storefront; denser but still consistent spacing in seller/admin data tables (density is a token-level variant, not a separate system).
- A shared grid/container system (max content width, responsive gutters) used by all three apps.

## 5. Product imagery

- **Consistent image ratio** across every product card and product detail gallery — a single fixed aspect ratio (e.g., 4:5 portrait, standard for fashion e-commerce) enforced at upload/display time so the grid never looks jagged regardless of seller.
- Images are center-cropped/contained consistently; sellers upload source images, the platform (object storage + a standard transform step) normalizes display dimensions rather than trusting each seller to pre-crop correctly.
- Placeholder/empty state for a product with no image yet (neutral placeholder graphic, never a broken-image icon).

## 6. Core shared components

- **Product card** *(implemented — `packages/ui` `ProductCard`/`ProductGrid`)* — image (fixed 4:5 ratio, neutral placeholder graphic when absent, never repeated title text), brand/seller name, title, price (and compare-at price if on sale), minimal by default (no badges/ribbons clutter; at most one status badge, e.g., "Sold out"). `ProductGrid` reflows 2 columns on mobile up to 4 on desktop, with matching skeleton/empty/error presentational components.
- **Product detail** — gallery, variant selectors (size/color), price, seller/brand link, description, reviews, shipping/return summary.
- **Cart / line item row** — image thumbnail, title, variant, seller name, quantity control, price, remove action; grouped visually by seller when the cart spans multiple sellers.
- **Forms & inputs** — label always visible (no placeholder-as-label), inline validation messaging, consistent error/success states, accessible focus rings.
- **Buttons** — primary (accent, one per view for the main action), secondary (neutral outline), destructive (semantic error color, used only for irreversible actions with confirmation).
- **Status badge** — one shared component for order/return/seller/moderation status, with a fixed mapping of status → semantic color + label (defined once, reused everywhere a status appears).
- **Data table** — shared across seller and admin portals (orders, products, payouts, moderation queue): sortable headers, pagination, row-level actions, empty/loading/error states built in, not re-implemented per screen.
- **Modal / drawer, toast, tooltip** — single shared implementation of each, used identically across all three apps.

## 7. States (every view must define all four)

Every data-driven view — product grid, cart, order list, dashboard, moderation queue — explicitly designs for:

1. **Loading** — skeleton placeholders matching the eventual content's shape (not a generic spinner for content-shaped regions), a spinner acceptable only for short, whole-page transitions.
2. **Empty** — a clear, specific empty state (e.g., "No orders yet" vs. a blank table), with a relevant next action where applicable (e.g., "Browse products").
3. **Error** — a clear, human-readable message distinct from a raw exception, with a retry action where retrying is meaningful.
4. **Success** — explicit confirmation for state-changing actions (toast, inline confirmation, or a dedicated success view for major flows like checkout/onboarding completion) — never a silent success with no feedback.

## 8. Accessibility

- All interactive elements reachable and operable by keyboard; visible focus indicators (never `outline: none` without a replacement).
- Color contrast meets WCAG AA for text and meaningful UI elements.
- Forms: every input has a programmatically associated label; errors are announced (via `aria-live` or equivalent) and associated with their field.
- Images have meaningful `alt` text (product images: seller-provided or auto-generated from product title, never empty on content-bearing images); purely decorative graphics use empty `alt`.
- Semantic HTML first (buttons are `<button>`, nav is `<nav>`, etc.); ARIA only fills genuine gaps, not a substitute for correct markup.
- **Found and fixed in the Batch 5 accessibility audit:** the storefront and seller-portal notification-list components (`features/notifications/components/notification-list.tsx`) originally used a clickable `<li onClick=...>` with no keyboard semantics - unreachable and non-operable by keyboard, a direct violation of the first bullet above. Fixed by converting each list item's interactive surface to a real `<button type="button">`, discovered via a proactive grep-based sweep of every `onClick` usage in the codebase (see `docs/DECISIONS.md`) rather than a report from the user - the kind of gap this section exists to catch before it ships.

## 9. Responsive behavior

- Three defined breakpoints: mobile, tablet, desktop — every shared component has a specified behavior at each, not just "it shrinks."
- Storefront: mobile-first (majority of fashion e-commerce traffic is mobile) — product grid reflows from multi-column desktop to single/double-column mobile; sticky add-to-cart/checkout affordances on mobile product pages.
- Seller/admin portals: desktop-first (data-table-heavy workflows), but must remain usable on tablet at minimum; full mobile parity for seller portal (a seller checking orders from a phone) is a v1 requirement for the core flows (view orders, mark shipped), not for every secondary screen.

## 10. Motion

- **Restrained animation** — motion communicates state change (a cart item added, a drawer opening), never used decoratively.
- Standard duration/easing tokens shared across apps (e.g., 150–200ms ease-out for entrances, 100–150ms ease-in for exits); no bespoke per-screen animation curves.
- Respects `prefers-reduced-motion` — non-essential motion is disabled for users who request it.

## 11. Token delivery

Design tokens (color, type scale, spacing scale, radii, shadows, motion durations) are defined once in `packages/ui` (e.g., as CSS variables/Tailwind config, finalized in [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md)) and consumed by all three Next.js apps — no app defines its own competing token set, and no app hardcodes a color/spacing value that already exists as a token.

## 12. Localization & layout resilience

Six supported locales — English `en-US` (fallback), Amharic `am`, Tigrinya `ti`, Afaan Oromo `om`, Simplified Chinese `zh-CN`, Spanish `es` — see [`ARCHITECTURE.md`](ARCHITECTURE.md) §12 for the i18n foundation and [`PRD.md`](PRD.md) §9.24 for the full requirement. Design implications:

- **No component is built to fit English string length exactly.** Buttons, nav items, form labels, and menu items must accommodate translated text that's meaningfully longer than the English source (German/Amharic/Spanish UI strings routinely run 20-40% longer) without truncating, overflowing, or breaking layout — this applies to mobile screens especially, where space is tightest.
- Prefer flexible layout primitives (flex/grid with `min-width`/`flex-wrap`, not fixed pixel widths) for any element that will render translated text.
- Where truncation is unavoidable (e.g., a product card title), truncate visually (`text-overflow: ellipsis`) but never truncate the underlying accessible name — screen readers and `title` attributes get the full string.
- **Accessibility labels are localized**, not hard-coded English — `aria-label`, `alt` text, and form error announcements (§8) all resolve through the same `t()`/fallback mechanism as visible UI text, not a separate hard-coded set.
- Non-Latin scripts (Amharic and Tigrinya use Ge'ez script) must render with correct font coverage and line-height — verify the chosen typography (§3) actually covers Ge'ez, Chinese (Simplified), and Latin-with-diacritics (Spanish) glyph ranges, or define a per-script font fallback stack rather than assuming one typeface covers everything.
- A language selector is a shared component (§6 pattern: one implementation, used identically wherever it appears), not a one-off per app.
