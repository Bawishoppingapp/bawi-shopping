# Owner Launch Inputs — Provide in This Order

Current completion and deferral status is tracked in `PRIVATE-BETA-LAUNCH-STATUS.md`.

Never commit passwords, API secrets, private keys, or live payment credentials. Enter secrets directly in the selected hosting provider or EAS secret environment.

## 1. Staging backend — needed for the private beta

1. Choose or provide the backend host.
2. Provide the resulting public HTTPS backend URL.
3. Create a staging Medusa publishable API key and provide the non-secret publishable key.
4. Confirm whether the staging database and backend already exist or should be deployed using the low-cost path in `docs/DEPLOYMENT-LOWCOST.md`.

These two values go in the EAS `preview` environment:

- `EXPO_PUBLIC_MEDUSA_BACKEND_URL`
- `EXPO_PUBLIC_MEDUSA_PUBLISHABLE_KEY`

## 2. Business and legal identity

- Exact registered company/legal name
- Country/state of registration and business registration number, if applicable
- Registered/business mailing address
- Customer support email and phone
- Privacy-request email
- Copyright/DMCA contact and agent details, if applicable
- Countries/regions where customers and sellers will initially be accepted
- Whether minors are prohibited and the minimum user age

## 3. Business rules for counsel and production configuration

- Platform commission percentage
- Seller payout hold period
- Return window and return-shipping responsibility
- Standard shipping fee and free-shipping threshold in ETB
- Seller preparation deadline
- Customer cancellation cutoff
- Initial delivery/service area
- Products/categories that are prohibited or restricted
- Expected retention periods for account, order, tax, audit, and support records—final values should be approved by counsel

## 4. Store accounts and public URLs

- Apple Developer account/team access
- Google Play Console developer account access
- Public Privacy Policy URL
- Public support/contact URL
- Marketing website URL, if used
- Store-facing support email and phone
- Final app subtitle/short description and public company/developer display name

## 5. Non-payment providers

- Production/staging hosting provider account
- PostgreSQL and Redis connection details through the host's secret manager
- S3-compatible storage choice and credentials/role
- Email provider choice, verified sending domain, from-address, and API credential
- Error tracking/APM provider and DSN
- Uptime-monitoring destination and alert email/phone

## 6. Ethiopian payment provider — later

No selection is needed for the payment-disabled beta. When ready, provide the bank/provider name, sandbox documentation, merchant identifier, sandbox credentials, webhook/signature specification, settlement agreement, and certification contact. See `docs/ETHIOPIAN-PAYMENT-INTEGRATION.md`.
