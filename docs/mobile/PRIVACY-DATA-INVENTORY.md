# Mobile Privacy and Store Disclosure Inventory

Working inventory for counsel, Apple privacy labels, and Google Play Data safety. Confirm it against the deployed production stack and every added third-party SDK before submission.

| Data category | Examples | Purpose | Stored/shared today |
|---|---|---|---|
| Account identifiers | Customer ID, seller user ID, email | Registration, login, account management | Backend database; email provider only when enabled |
| Contact information | Name, email, phone | Orders, seller onboarding, delivery, support | Backend database; courier/email provider only when enabled |
| Address information | Delivery and seller business addresses | Shipping, service eligibility, seller review | Backend database; courier only when enabled |
| Authentication data | Password-derived authentication identity, bearer session token | Secure sign-in | Backend auth system; session token stored in device SecureStore |
| Purchase information | Cart, order items, totals, returns, refunds, order status | Commerce and customer history | Backend database; future payment provider receives necessary transaction data |
| Payment references | Provider transaction/reference IDs, status | Payment reconciliation and refunds | Not active in mobile beta; future backend/payment provider |
| User content | Seller product titles, descriptions, translations, and product photos | Marketplace listings | Backend and configured file storage |
| Preferences | Language, appearance, display currency | Personalize the app | Device SecureStore; not used for advertising |
| Saved activity | Wishlist and notification read state | Customer-requested app features | Backend database |
| Device identifiers | Expo push token | Deliver transactional push notifications | Backend and Expo Push Service after permission/token registration |
| Diagnostics/security | IP address and administrative audit records | Abuse prevention, security, accountability | Backend logs/audit database; no third-party APM currently configured |
| Seller business data | Store name, contact data, business address, application status | Seller review and marketplace operation | Backend database and authorized administrators |

Current code contains no advertising SDK and no analytics SDK. It does not request location, contacts, microphone, or camera permission. Seller photo selection requests photo-library access; notifications request push permission. Re-check this statement whenever dependencies change.

Items requiring owner/counsel decisions:

- Exact retention periods and lawful bases
- Production hosting/data locations and cross-border transfers
- Final processors/subprocessors
- Whether any data is sold, used for tracking, or used for targeted advertising
- Minimum age and treatment of minors
- Data-subject request verification and response process
- Financial/order records retained after account deletion

