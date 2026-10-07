# SmartRide — Phase 0 Step 4: Ride OTP Security Hardening

## 1. Executive Summary

Phase 0 Step 4 focused exclusively on auditing, remediating, and hardening the SmartRide 4-digit Ride Start and Boarding One-Time Password (OTP) architecture. Prior to this hardening step, the boarding OTP system exhibited severe security deficiencies including hardcoded static bypass values (`'4821'`), plaintext client-side exposure in UI placeholders and JSX, lack of cryptographic entropy, client-authoritative state transitions (`PATCH /api/driver/roster`), unauthenticated access paths, absence of attempt bounding/brute-force lockouts, and no cryptographic single-use enforcement.

This hardening initiative establishes a **server-authoritative, cryptographically resilient, context-bound OTP lifecycle**. Commuters obtain dynamically generated 4-digit OTPs backed by Node.js CSPRNG (`crypto.randomInt`), secured server-side via salted HMAC-SHA256 hashes with constant-time equality comparisons (`crypto.timingSafeEqual`), strictly bounded by a 30-minute time-to-live (TTL), limited to a maximum of 3 failed verification attempts before automatic lockout, and consumed atomically upon successful passenger boarding. Direct database mutations bypassing OTP verification have been sealed at the API layer, and excessive verification failures automatically trigger platform safety alerts (`MULTIPLE_OTP_FAILURES`) and sanitized security audit logs.

---

## 2. Threat Model & Vulnerabilities Identified

During initial code inspection, the following critical vulnerabilities were identified and documented:

| Vulnerability ID | Location | Description | Severity | Remediation |
|---|---|---|---|---|
| **VULN-OTP-01** | `src/app/commuter/dashboard/page.tsx:815` | Hardcoded static OTP string `'4821'` displayed in commuter dashboard badge. | **CRITICAL** | Replaced with dynamic server-fetched OTP via authenticated `GET /api/commuter/otp`. |
| **VULN-OTP-02** | `src/app/driver/dashboard/page.tsx:1056` | Input placeholder hardcoded to `placeholder="OTP (4821)"`, leaking bypass value to drivers. | **HIGH** | Replaced with generic placeholder `placeholder="4-digit OTP"`. |
| **VULN-OTP-03** | `src/lib/firebase.ts:883` | Direct verification bypass: `cleanEntered !== '4821'` allowed arbitrary verification using `'4821'`. | **CRITICAL** | Purged hardcoded bypass; delegated verification exclusively to server-authoritative endpoint. |
| **VULN-OTP-04** | `src/lib/firebase.ts:474-478` | Static passenger templates hardcoded demo OTPs (`'4821'`, `'5924'`, `'7319'`). | **HIGH** | Made `rideOtp` optional; removed static secrets from mock passenger profiles. |
| **VULN-OTP-05** | `src/app/api/driver/roster/route.ts` | Commuters could be transitioned to `status: 'BOARDED'` directly without proving OTP verification. | **CRITICAL** | Enforced server check rejecting direct `BOARDED` mutation unless `isCommuterOtpVerified` is true. |
| **VULN-OTP-06** | OTP Generation / Storage | No cryptographic PRNG; OTPs stored or exposed in plaintext. | **HIGH** | Implemented `crypto.randomInt(0, 10000)` and salted HMAC-SHA256 hashing. |
| **VULN-OTP-07** | Verification Attempt Limits | Unlimited guessing allowed brute-force recovery of 4-digit code (1 in 10,000 combinations). | **CRITICAL** | Bounded attempts to 3 max. Fourth attempt permanently locks OTP and raises safety event. |
| **VULN-OTP-08** | Lifetime & Replay | OTPs did not expire and could be replayed across shifts or trips. | **HIGH** | Implemented strict 30-minute TTL and atomic single-use flag (`isConsumed: true`). |
| **VULN-OTP-09** | Identity & Context Binding | Lack of server-enforced route, driver, shift, and commuter context binding. | **HIGH** | Verification strictly validates driver assignment, route ID, trip type, and commuter ID. |
| **VULN-OTP-10** | Timing Side-Channels | String equality (`===`) exposed verification to timing analysis. | **MEDIUM** | Enforced constant-time buffer comparison via `crypto.timingSafeEqual`. |

---

## 3. Server-Authoritative Architecture

The hardened OTP lifecycle operates entirely under server authority. At no point is the client permitted to dictate OTP generation, calculate hashes, set expiration timestamps, reset attempt counters, or mark attendances as boarded without server validation.

```
+--------------------------------------------------------------------------------------------------------+
|                                    COMMUTER BOARDING WORKFLOW                                         |
+--------------------------------------------------------------------------------------------------------+
   COMMUTER CLIENT                                                                       DRIVER CLIENT
         |                                                                                     |
         | 1. GET /api/commuter/otp?routeId=...&date=...&tripType=...                          |
         v                                                                                     |
[Next.js API Gateway]                                                                          |
         | (Verify JWT: Role = COMMUTER or ADMIN)                                              |
         v                                                                                     |
[src/lib/security/ride-otp.ts]                                                                 |
         | Check active valid OTP in memory/state                                              |
         | If none or expired:                                                                 |
         |   - crypto.randomInt(0, 10000) -> "0482"                                            |
         |   - HMAC-SHA256(code, salt) -> record.otpHash                                       |
         |   - expiresAt = now + 30m, attempts = 3                                             |
         v                                                                                     |
   Returns: { code: "0482", expiresAt: ... }                                                   |
         |                                                                                     |
         | Commuter communicates code verbally or shows screen                                  |
         +------------------------------------------------------------------------------------>|
                                                                                               |
                                             2. POST /api/driver/otp/verify                    |
                                                { routeId, commuterId, otp: "0482", ... }      |
                                                                                               v
                                                                                     [Next.js API Gateway]
                                                                                               | (Verify JWT: Role = DRIVER)
                                                                                               v
                                                                                     [Server Assignment Check]
                                                                                               | Verify Driver assigned to Route
                                                                                               v
                                                                                     [OTP Security Engine]
                                                                                               | Lock verification mutex
                                                                                               | Constant-time Hash Match?
                                                                                               | [MATCH]
                                                                                               |   -> isConsumed = true
                                                                                               |   -> Attendance status = 'BOARDED'
                                                                                               |   -> Audit Log: OTP_VERIFIED
                                                                                               | [MISMATCH]
                                                                                               |   -> attemptsRemaining--
                                                                                               |   -> If 0: isLocked = true,
                                                                                               |            Emit MULTIPLE_OTP_FAILURES
                                                                                               v
                                                                                     Returns: { success: true }
```

---

## 4. Cryptographic Implementation

### 4.1 CSPRNG 4-Digit Code Generation
OTPs are generated using Node.js's standard cryptographic random integer generator:
```typescript
function generateNumericOtp(length: number = 4): string {
  const max = Math.pow(10, length);
  const num = crypto.randomInt(0, max);
  return num.toString().padStart(length, '0');
}
```
- **Uniform Distribution**: `crypto.randomInt` prevents modulo bias across the range $[0, 9999]$.
- **Format Consistency**: Padded with leading zeros to guarantee exactly 4 numeric characters.

### 4.2 Hash and Salt Derivation
Plaintext OTPs are never stored in system records or long-term caches. Only salted hashes are retained:
```typescript
function hashOtp(otp: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(otp).digest('hex');
}
```
- **Per-OTP Salt**: Each generated OTP generates a unique 16-byte random salt (`crypto.randomBytes(16).toString('hex')`).
- **Algorithm**: HMAC-SHA256 ensures high pre-image resistance and prevents rainbow table attacks.

### 4.3 Constant-Time Comparison
To eliminate side-channel timing attacks where string comparison terminates early on mismatched characters, comparisons are performed via `crypto.timingSafeEqual`:
```typescript
function constantTimeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
```

---

## 5. OTP Lifecycle Management

### 5.1 State Transitions
The OTP lifecycle enforces deterministic, non-reversible states:
1. **PENDING**: OTP generated, active, unconsumed, `expiresAt > Date.now()`, `attemptsRemaining > 0`.
2. **VERIFIED / CONSUMED**: Entered code matched hash, `isConsumed = true`, `consumedAt = timestamp`. Cannot be reused.
3. **EXPIRED**: Current time exceeds `expiresAt` (30 minutes). Further verification attempts rejected.
4. **LOCKED**: 3 consecutive failed verification attempts exhausted. `isLocked = true`. Safety alert triggered.

### 5.2 Attempt Tracking & Brute-Force Lockout
- Maximum verification attempts allowed: **3**.
- With $10,000$ possible 4-digit permutations, 3 attempts restrict an attacker's guessing probability to $0.03\%$.
- Each failed attempt decrements `attemptsRemaining`.
- Upon reaching $0$ attempts remaining, `isLocked` is flagged as `true`. Subsequent verification attempts return HTTP 429 (Too Many Requests) or HTTP 400 with `code: 'OTP_LOCKED'`.

---

## 6. Scoped Authorization & Context Binding

To prevent cross-trip, cross-commuter, or cross-driver substitution:
1. **Commuter Scope**:
   - `GET /api/commuter/otp` requires an authenticated JWT session (`COMMUTER` or `ADMIN`).
   - Commuters can only request OTPs for their own commuter ID (`req.session.userId === commuterId`).
2. **Driver Scope**:
   - `POST /api/driver/otp/verify` requires an authenticated JWT session (`DRIVER` or `ADMIN`).
   - The driver must be explicitly assigned to the route (`route.driverId === req.session.userId`).
   - Commuter must have a valid scheduled attendance on that specific route, date, and shift (`AM` or `PM`).

---

## 7. Race Condition Prevention & Atomic Consumption

Concurrent verification requests (e.g., an automated script firing simultaneous OTP guesses to exploit latency windows) are mitigated via an in-memory execution lock (`verificationLock` mutex):
- When a verification operation begins for a specific `commuterId`, a lock is acquired.
- Competing concurrent verification attempts are rejected immediately with HTTP 409 (`VERIFICATION_IN_PROGRESS`).
- Upon successful match, `isConsumed` is set to `true` synchronously within the locked scope before the mutex is released.

---

## 8. Safety Incident Integration & Audit Logging

### 8.1 Safety Alert Emission
When an OTP enters the `isLocked` state (3 failed attempts):
- A safety alert record is created:
  ```json
  {
    "type": "MULTIPLE_OTP_FAILURES",
    "severity": "MEDIUM",
    "routeId": "route-north-01",
    "tripId": "trip-...",
    "details": "Multiple invalid OTP attempts detected for commuter user_commuter_123. Verification locked."
  }
  ```
- This seamlessly integrates with the Phase 3 Step 1 Safety Alerting and Master Control pipelines.

### 8.2 Audit Log Sanitization
To prevent credential leaks in logging services:
- All audit log events sanitize sensitive keys:
  - `rideOtp` $\rightarrow$ `[REDACTED_OTP]`
  - `otp` $\rightarrow$ `[REDACTED_OTP]`
  - `enteredOtp` $\rightarrow$ `[REDACTED_OTP]`
- Failure messages never output the expected OTP value:
  - Error: `Invalid OTP code. 2 attempts remaining.` (Expected code is never leaked).

---

## 9. API Reference

### 9.1 `GET /api/commuter/otp`
Retrieves or initializes the active boarding OTP for the authenticated commuter.
- **Headers**: `Cookie: auth_token=<JWT>` (Role: `COMMUTER` or `ADMIN`)
- **Query Parameters**:
  - `routeId` (string, required)
  - `date` (string YYYY-MM-DD, optional, defaults to today)
  - `tripType` (`AM` | `PM`, optional, defaults to current time-based shift)
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "otp": "4821",
    "expiresAt": "2026-10-03T01:00:00.000Z",
    "tripType": "AM",
    "date": "2026-10-03",
    "routeId": "route-north-01"
  }
  ```

### 9.2 `POST /api/driver/otp/verify`
Authorizes and completes commuter boarding by verifying their 4-digit OTP.
- **Headers**: `Cookie: auth_token=<JWT>` (Role: `DRIVER` or `ADMIN`)
- **Body**:
  ```json
  {
    "routeId": "route-north-01",
    "commuterId": "user_commuter_123",
    "otp": "4821",
    "date": "2026-10-03",
    "tripType": "AM"
  }
  ```
- **Responses**:
  - `200 OK`: `{ "success": true, "status": "BOARDED", "passengerName": "Alice Walker" }`
  - `400 Bad Request`: `{ "error": "Invalid OTP code. 2 attempts remaining.", "code": "INVALID_OTP" }`
  - `400 Bad Request`: `{ "error": "OTP has expired.", "code": "OTP_EXPIRED" }`
  - `400 Bad Request`: `{ "error": "OTP has already been used.", "code": "OTP_ALREADY_USED" }`
  - `403 Forbidden`: `{ "error": "Driver is not assigned to this route.", "code": "DRIVER_UNAUTHORIZED" }`
  - `429 Too Many Requests`: `{ "error": "OTP locked due to excessive failed attempts.", "code": "OTP_LOCKED" }`

### 9.3 `PATCH /api/driver/roster`
Updates commuter attendance status (e.g. `ABSENT`, `NO_SHOW`).
- **Security Check**: Attempting to set `status: 'BOARDED'` without passing the internal verification guard `isCommuterOtpVerified === true` is rejected with `HTTP 400 Bad Request: "Direct boarding prohibited. Passenger must be verified via OTP."`.

---

## 10. Front-End Changes & Insecure Default Remediation

1. **`src/app/commuter/dashboard/page.tsx`**:
   - Removed static JSX `<span className="font-mono text-2xl font-bold text-blue-600">4821</span>`.
   - Added `activeOtp` and `otpExpiresAt` state fetched asynchronously from `/api/commuter/otp`.
   - Rendered real-time countdown timer indicating OTP validity.
2. **`src/app/driver/dashboard/page.tsx`**:
   - Removed `placeholder="OTP (4821)"` and replaced with neutral `placeholder="4-digit OTP"`.
   - Rewrote `handleVerifyOtp` to issue `POST /api/driver/otp/verify` with complete route and passenger context.
3. **`src/lib/firebase.ts`**:
   - Deleted backdoor comparison `cleanEntered !== '4821'`.
   - Delegated `verifyPassengerOtp` to server route.
   - Cleansed mock passenger array in `defaultTrip`.

---

## 11. Security Verification Matrix

| # | Test Assertion | Implementation | Result |
|---|---|---|---|
| 1 | Server-side OTP generation via authenticated API | `GET /api/commuter/otp` | **PASSED** |
| 2 | Cryptographically secure PRNG | `crypto.randomInt(0, 10000)` | **PASSED** |
| 3 | Exactly 4 digits with zero-padding (0000-9999) | `String.padStart(4, '0')` | **PASSED** |
| 4 | OTP not exposed to unauthenticated callers | JWT session guard (HTTP 401) | **PASSED** |
| 5 | Client cannot inject or set custom OTP | Disallow POST on generation route | **PASSED** |
| 6 | Unauthenticated verification rejected | Driver auth guard (HTTP 401/403) | **PASSED** |
| 7 | Unauthorized driver cannot verify route OTP | Route assignment check (HTTP 403) | **PASSED** |
| 8 | Commuters cannot invoke driver verification endpoint | Role check enforces `DRIVER` | **PASSED** |
| 9 | Valid OTP for correct trip succeeds | Returns `BOARDED` (HTTP 200) | **PASSED** |
| 10 | Wrong OTP fails verification | Returns `INVALID_OTP` (HTTP 400) | **PASSED** |
| 11 | Expected OTP never leaked in error response | Generic error messages | **PASSED** |
| 12 | Expired OTP rejected | 30-minute TTL check (HTTP 400) | **PASSED** |
| 13 | Single-use consumption enforced | `isConsumed: true` prevents replay | **PASSED** |
| 14 | Attempt counter decrements on failure | Tracked per OTP record | **PASSED** |
| 15 | Brute-force lockout after 3 failures | `isLocked: true` (HTTP 429) | **PASSED** |
| 16 | Client cannot manipulate expiration | Server computes `expiresAt` | **PASSED** |
| 17 | Direct boarding mutation rejected | `PATCH /api/driver/roster` guard | **PASSED** |
| 18 | Shift/tripType substitution prevented | Strict shift matching | **PASSED** |
| 19 | Commuter ID substitution prevented | Strict commuter matching | **PASSED** |
| 20 | Driver identity derived from server session | Never trusted from payload | **PASSED** |
| 21 | OTP secrets sanitized in audit logs | Redaction filter applied | **PASSED** |
| 22 | No `'4821'` bypass exists in source/UI | Static audit verification | **PASSED** |
| 23 | Legitimate booking/subscription flow preserved | Regression test passed | **PASSED** |
| 24 | Driver roster flow preserved | Regression test passed | **PASSED** |
| 25 | Commuter subscription flow preserved | Regression test passed | **PASSED** |
| 26 | Phase 1 core functionality preserved | `/api/routes` regression passed | **PASSED** |
| 27 | Phase 3 operational intelligence preserved | `/api/safety/alerts` regression passed | **PASSED** |

---

## 12. Failure Modes & Edge Case Handling

1. **Network Timeout during Verification**:
   - The verification lock automatically releases in a `finally` block, ensuring no permanent deadlock occurs.
2. **Clock Drift between Client and Server**:
   - Expiration evaluation is 100% server-authoritative (`Date.now() > record.expiresAt`). Client timestamps are ignored.
3. **Driver Offline at Boarding**:
   - Driver client catches network failures gracefully and prompts for retry without consuming attempts on the server.
4. **Commuter Changes Route or Schedule**:
   - Requesting an OTP for a newly scheduled route triggers a fresh lifecycle keyed to that specific route and shift.

---

## 13. Operational & Deployment Guide

- **Prerequisites**: No database migrations or schema alterations required.
- **Environment Variables**: Uses existing server-authoritative environment configuration. No client-exposed OTP environment variables.
- **Server Restart**: In-memory OTP records initialize cleanly; existing attendances in Firestore/Prisma maintain their authoritative state.
- **Audit Monitoring**: Security teams can query `AuditLog` where `action IN ('OTP_GENERATED', 'OTP_VERIFIED', 'OTP_VERIFICATION_FAILED', 'OTP_LOCKED')` to monitor boarding integrity.
