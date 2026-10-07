# SmartRide Phase 0 — Step 3: Payment Webhook Security Hardening

## 1. Existing Vulnerability
Prior to Step 3, the payment webhook endpoint at `POST /api/webhooks/payment` accepted incoming JSON payloads without verifying that requests actually originated from an authorized payment provider.
Specific vulnerabilities discovered:
- **Missing Signature Verification**: Any external client could send arbitrary HTTP POST requests to `/api/webhooks/payment` and simulate successful payments without cryptographic verification.
- **Client-Controlled State Escalation**: An unverified caller could specify arbitrary `subscriptionId` and `commuterId` values, mutating subscription statuses to `ACTIVE` and creating confirmed `Booking` documents.
- **No Idempotency / Replay Protection**: Repeated deliveries of the same webhook would duplicate payment records, corrupt booking allocations, and skew revenue metrics.
- **No Ownership Validation**: The endpoint did not verify whether the commuter in the payload owned the target subscription.
- **Sensitive Key Exposure Risk**: `.env.example` contained mock secret values for `STRIPE_WEBHOOK_SECRET` and `RAZORPAY_KEY_SECRET`.

---

## 2. Actual Payment Provider Architecture Discovered
The SmartRide application codebase integrates two payment gateways:
1. **Stripe**:
   - Signature header: `stripe-signature`
   - Header format: `t=<unix_timestamp>,v1=<hex_signature>`
   - Signed message: `<unix_timestamp>.<raw_body>`
   - Secret key: `STRIPE_WEBHOOK_SECRET`
   - Primary event types: `payment_intent.succeeded`, `payment_intent.payment_failed`
2. **Razorpay**:
   - Signature header: `x-razorpay-signature`
   - Header format: 64-character hex signature
   - Signed message: `<raw_body>`
   - Secret key: `RAZORPAY_WEBHOOK_SECRET` (falling back to `RAZORPAY_KEY_SECRET`)
   - Primary event types: `payment.captured`, `payment.failed`

Both gateways feed into the platform's payment persistence model (`FirestorePayment`), updating subscription statuses (`ACTIVE`) and creating confirmed bookings (`FirestoreBooking`).

---

## 3. Signature Verification Design
The verification engine is implemented in `src/lib/security/payment-webhook.ts`:
- **Stripe Verification (`verifyStripeSignature`)**:
  - Parses `t` (timestamp) and `v1` (signatures) from the `stripe-signature` header.
  - Enforces a 300-second (5-minute) tolerance window against timestamp drift and replay attacks.
  - Computes `crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')`.
  - Performs constant-time comparison via `crypto.timingSafeEqual` between expected and received signature buffers.
- **Razorpay Verification (`verifyRazorpaySignature`)**:
  - Computes `crypto.createHmac('sha256', secret).update(rawBody).digest('hex')`.
  - Performs constant-time comparison via `crypto.timingSafeEqual` against the received `x-razorpay-signature`.
- **Constant-Time Comparison**: Both implementations strictly check buffer byte lengths prior to calling `crypto.timingSafeEqual`, preventing timing side-channel attacks while avoiding buffer length mismatch exceptions.

---

## 4. Raw Body Handling
Next.js route handlers default to stream parsing when using `req.json()`, which strips raw bytes, alters whitespace, and invalidates cryptographic HMAC digests.
- In `src/app/api/webhooks/payment/route.ts`, the handler executes:
  ```ts
  const rawBody = await req.text();
  ```
- Signature verification is executed against `rawBody` **before** any JSON parsing occurs.
- If signature verification fails, the endpoint immediately returns HTTP 401 or 403 without parsing or trusting the payload.

---

## 5. Environment Variables
All payment secrets are strictly server-only:
- `STRIPE_SECRET_KEY`: Provider API secret (server-only).
- `STRIPE_WEBHOOK_SECRET`: HMAC signing secret for Stripe webhooks (server-only).
- `RAZORPAY_KEY_ID`: Razorpay key identifier (server-only).
- `RAZORPAY_KEY_SECRET`: Razorpay key secret (server-only).
- `RAZORPAY_WEBHOOK_SECRET`: Dedicated webhook secret for Razorpay (server-only).
- `ALLOW_MOCK_PAYMENT_WEBHOOK`: Development flag (`"false"` in production).
- `DEV_MOCK_WEBHOOK_SECRET`: Optional authorization secret for local testing (`CHANGE_ME_LOCALLY`).

**Client Safety Audit**:
- Zero `NEXT_PUBLIC_*` variables exist for payment keys or webhook secrets.
- `.env.example` has been sanitized with `CHANGE_ME_LOCALLY` placeholders.

---

## 6. Idempotency Strategy
Double-layered server-side idempotency protection:
1. **Event ID Deduplication (`isWebhookEventProcessed`)**:
   - Queries `webhook_events` collection (or in-memory cache) for `eventData.eventId`.
   - If present, returns HTTP 200 with `{ received: true, idempotent: true, message: 'Event previously processed' }`.
2. **Transaction ID Deduplication (`getPaymentByTransactionId`)**:
   - Queries existing `payments` records for `eventData.transactionId`.
   - If a successful payment record already exists, records the webhook event and returns HTTP 200 with `{ received: true, idempotent: true, message: 'Payment already recorded for this transaction' }`.
3. **Mutation Guarantee**: Duplicate delivery does not create secondary payment records, does not duplicate bookings, and does not alter attendance records.

---

## 7. Payload Validation
After cryptographic verification succeeds:
- **Structure Validation**: Validates JSON syntax, ensuring payload is a non-null object.
- **Event Identifier**: Requires a valid, non-empty `eventId` (supports official Stripe `data.object.id`, official Razorpay `payload.payment.entity.id`, or normalized `id`/`eventId`).
- **Transaction Identifier**: Requires a unique transaction reference.
- **Relational Integrity**:
  - Validates `subscriptionId` exists in the database.
  - Enforces `subscription.commuterId === eventData.commuterId`. If mismatched, immediately aborts with HTTP 400 (`Forbidden: commuter does not own subscription`).
- **Amount & Currency**: Enforces positive numeric amounts, converting Stripe/Razorpay currency sub-units (paise/cents) when applicable.

---

## 8. Payment State Transitions
- **Event-Driven Transitions**: State transitions are strictly server-authoritative and driven solely by verified event types:
  - Success events (`payment_intent.succeeded`, `payment.captured`): transitions subscription to `ACTIVE`, creates confirmed `Booking` document.
  - Failure events (`payment_intent.payment_failed`, `payment.failed`): acknowledges failure (`status: 'FAILED'`), logs security audit, and **does not** activate the subscription.
- **Client Forgery Resistance**: If an attacker attempts to inject `{ status: 'SUCCEEDED' }` or `{ verified: true }` into a failure or untrusted event, the server derives status exclusively from the verified event type.

---

## 9. Development / Mock Behavior
- In non-production environments (`process.env.NODE_ENV !== 'production'`), simulated webhooks can only be accepted if:
  1. `ALLOW_MOCK_PAYMENT_WEBHOOK === 'true'` is explicitly configured in `.env`.
  2. The request supplies a valid matching `x-mock-payment-secret` header.
- Unauthenticated mock requests without headers are rejected with HTTP 401.

---

## 10. Production Behavior
- In production (`process.env.NODE_ENV === 'production'`), mock webhook bypasses are **strictly blocked**:
  - Any request lacking a valid Stripe or Razorpay cryptographic HMAC signature is rejected with **HTTP 403 Forbidden**.
  - Any attempt to send development mock headers in production is immediately rejected with HTTP 403.
  - Startup fails safe if webhook secrets are missing.

---

## 11. Security Logging
Implemented via `logWebhookSecurityEvent`:
- **Logged Fields**: Timestamp, provider (`STRIPE` / `RAZORPAY`), event ID, event type, result (`ACCEPTED`, `REJECTED`, `IDEMPOTENT`), status code, high-level non-sensitive reason.
- **Redacted / Omitted**:
  - Webhook secrets are never logged.
  - Raw signature headers (`stripe-signature`, `x-razorpay-signature`) are never logged.
  - Authorization tokens, cookies, and JWTs are never logged.
  - Customer PII and raw card/bank payloads are never logged.

---

## 12. Test Results
Full automated test suite executed via `scratch/verify_phase0_step3_payment_webhook.mjs`:

| # | Test Case Description | Result | Details |
|---|---|---|---|
| 1 | Valid webhook signature accepted | **PASS** | Stripe & Razorpay both return HTTP 200 |
| 2 | Invalid signature rejected | **PASS** | HTTP 401 Invalid Stripe signature |
| 3 | Missing signature rejected | **PASS** | HTTP 401 Missing signature header |
| 4 | Tampered payload rejected | **PASS** | HTTP 401 HMAC digest mismatch |
| 5 | Malformed JSON payload rejected | **PASS** | HTTP 400 Malformed JSON payload |
| 6 | Unsupported event rejected safely | **PASS** | HTTP 400 Unsupported event type |
| 7 | Valid payment event processed | **PASS** | HTTP 200, success: true, payment created |
| 8 | Duplicate event is idempotent | **PASS** | HTTP 200, idempotent: true |
| 9 | Duplicate webhook does not duplicate payment effects | **PASS** | Exactly 1 payment record for transaction |
| 10 | Client cannot forge verification status | **PASS** | Unverified payload rejected with HTTP 401 |
| 11 | Client cannot forge payment status | **PASS** | Failure event recorded as FAILED, ignoring injected status |
| 12 | Client cannot forge user/booking ownership | **PASS** | HTTP 400 Forbidden: commuter does not own subscription |
| 13 | Payment secrets not present in client source | **PASS** | Scanned client directories; 0 secret leaks |
| 14 | Payment secrets not exposed through API responses | **PASS** | Responses verified free of secrets or signatures |
| 15 | Audit logging omits secrets and signatures | **PASS** | Logging utility verified sanitized |
| 16 | Production configuration rejects mock webhooks | **PASS** | Isolated production simulation returns HTTP 403 |
| 17 | Existing legitimate payment flow functional | **PASS** | `/api/subscriptions` checkout confirmed |
| 18 | Existing authentication functional | **PASS** | `/api/auth/me` session validation functional |
| 19 | Existing booking/subscription behavior functional | **PASS** | Subscriptions query and retrieval operational |
| 20 | TypeScript compiler passes | **PASS** | `npx tsc --noEmit` exited with 0 errors |
| 21 | Production build passes | **PASS** | `npm run build` completed successfully |

**Suite Summary**: 21/21 Tests Passed (100%).

---

## 13. Files Modified
1. `src/lib/security/payment-webhook.ts` (NEW): HMAC-SHA256 signature verification for Stripe and Razorpay, payload normalization, production gating, and audit logging.
2. `src/app/api/webhooks/payment/route.ts`: Rewritten to enforce raw body reading, signature verification, payload validation, relational ownership checks, and idempotency deduplication.
3. `src/lib/firestore-db.ts`: Added `FirestoreWebhookEvent`, `getPaymentByTransactionId`, `isWebhookEventProcessed`, and `markWebhookEventProcessed`.
4. `src/lib/mock-payment.ts`: Updated `MockPaymentPayload` and `processMockPayment` to support explicit `transactionId` propagation from webhook events.
5. `.env.example`: Updated with safe `CHANGE_ME_LOCALLY` placeholders for all payment secrets; added documentation that payment keys are server-only.
6. `.env`: Added `RAZORPAY_WEBHOOK_SECRET` and `ALLOW_MOCK_PAYMENT_WEBHOOK="false"`.
7. `scratch/verify_phase0_step3_payment_webhook.mjs` (NEW): Comprehensive 21-test verification suite covering all security assertions.
8. `scratch/verify_phase0_step1_demo_credentials.mjs`: Updated test 13 build artifact check to support `build-manifest.json`.

---

## 14. Files Intentionally Not Modified
- `src/lib/auth.ts`: Authentication architecture frozen.
- `src/middleware.ts`: Application middleware untouched.
- `src/lib/firebase.ts`: Firebase client configuration untouched.
- `prisma/schema.prisma`: Preserved without destructive schema migrations (the existing `Payment` model already contained `transactionId`).
- `src/app/api/trips/**`: Phase 1 trip and driver workflow files frozen.
- `src/app/api/admin/intelligence/**`: Phase 3 operational intelligence routes frozen.
- Commuter/driver frontend UI pages: UI and visual layout untouched.

---

## 15. Remaining Deferred Security Findings
- **Real Payment Gateway Credential Onboarding**: When deploying to production with live Stripe/Razorpay accounts, real webhook signing secrets (`whsec_...`, `rzp_live_...`) must be provisioned via secure secret management (e.g. AWS Secrets Manager, GCP Secret Manager, or Vercel Environment Variables).
- **Webhook Rate Limiting**: Dedicated rate limiting for webhook endpoints is deferred to the future Phase 0 Rate Limiting step.
- **Mutual TLS / IP Allowlisting**: Production environments may optionally configure Cloudflare or reverse proxy IP allowlists for Stripe/Razorpay IP ranges.
