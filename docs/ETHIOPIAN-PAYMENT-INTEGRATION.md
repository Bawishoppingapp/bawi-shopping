# Ethiopian Payment Integration Handoff

The backend now has a provider-neutral contract in `apps/backend/src/payments/ethiopian-payment-gateway.ts`. It is intentionally inactive and cannot move money. Customer checkout remains on its payment-disabled screen.

## Information to request from the selected bank or payment provider

- Sandbox and production API documentation and base URLs
- Merchant onboarding requirements and settlement bank-account requirements
- Authentication method, credential rotation process, and IP allowlisting rules
- ETB minor-unit rules, transaction limits, fees, settlement timing, and reconciliation files
- Payment initiation and customer-authorization flow (redirect, app-to-app, OTP, QR, or USSD)
- Idempotency behavior and merchant-reference constraints
- Payment status query API and complete status/error-code list
- Webhook events, retry policy, signature verification, replay protection, and source IP ranges
- Cancellation, reversal, partial/full refund, dispute, and timeout behavior
- Sandbox test accounts, reviewer test flow, and production certification steps
- PCI DSS and National Bank of Ethiopia compliance responsibilities assigned to each party

## Adapter work after a provider is selected

1. Implement `EthiopianPaymentGateway` for that provider. Keep credentials backend-only.
2. Register the adapter using `registerEthiopianPaymentProvider` during backend startup.
3. Map every proprietary provider status into the canonical statuses in the contract.
4. Store provider references and webhook event IDs; enforce idempotency and webhook replay protection.
5. Connect the adapter to a server-side checkout workflow that recalculates totals and never accepts a client-supplied payable amount.
6. Complete sandbox certification for success, decline, timeout, duplicate request, delayed webhook, cancellation, refund, and reconciliation.
7. Only after approval, set the provider configuration and enable `live_payments_enabled` through the controlled production process.

Until all seven steps are complete, keep `ETHIOPIAN_PAYMENT_PROVIDER=disabled` and every real-money feature flag false.
