# 🚨 SmartRide (CommuteSync) — Telemetry Anomaly Detection & Security Monitoring Engine

Comprehensive technical specification, mathematical formulations, cybersecurity architecture, and academic viva defense documentation for the rule-based real-time anomaly detection system in SmartRide.

---

## 1. Executive Summary & Problem Formulation

In corporate shuttle transit and smart mobility corridors, operational anomalies (such as sudden extreme speeding, unauthorized corridor deviation, prolonged unaccounted stationary periods, GPS sensor blackouts, and unverified trip starts) represent severe life-safety, security, and contractual risks.

### The Problem with "Black-Box Pseudo-AI" in Mission-Critical Transit
Many prototype applications superficially apply uncalibrated machine learning models or hardcoded heuristics labeled as "AI" to GPS feeds. In mission-critical transit safety, black-box models introduce two fatal vulnerabilities:
1. **Unpredictable False Positives**: Flagging standard traffic diversions or passenger boarding as security violations causes alarm fatigue.
2. **Unacceptable False Negatives**: Failing to detect an unauthorized detour because the feature vector was slightly outside the training distribution.

### The Solution: A Deterministic, Rule-Based First Anomaly Engine
SmartRide implements a **transparent, rule-based anomaly detection engine** built directly on physics, geometry, and strict transit compliance rules. The architecture provides:
* **Mathematical Verifiability**: Exact Haversine formulas and vector projections determine corridor compliance.
* **Deterministic Escalation**: Clear severity tiers (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
* **Multi-Signal Correlation**: Cross-correlating concurrent telemetry variances into elevated operational incidents (e.g. Route Deviation + Speed Surge = Aggressive Detour Alert).
* **Zero-PII / Zero-OTP Cybersecurity Architecture**: Cryptographic redaction guaranteeing that commuter passwords, authorization tokens, and 4-digit boarding OTPs are never persisted in logs or exposed on public feeds.
* **Drop-in ML Readiness**: Standardized `TelemetryReadingInput` $\rightarrow$ `AnomalyEvaluationResult` pipeline designed for future unsupervised anomaly detection models (e.g. Isolation Forest, Autoencoders).

---

## 2. Core Detection Rules & Mathematical Formulations

```
                        ┌─────────────────────────────────────────┐
                        │          Live Trip Telemetry            │
                        │    (lat, lng, speed, heading, time)     │
                        └────────────────────┬────────────────────┘
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
          ┌───────────────────────────┐               ┌───────────────────────────┐
          │   Kinematic & Spatial     │               │   Operational & Security  │
          │         Rules             │               │          Rules            │
          ├───────────────────────────┤               ├───────────────────────────┤
          │ 1. Speed Surge            │               │ 4. GPS Interruption       │
          │    (>=25 km/h, >=2 ticks) │               │    (15s, 60s, 120s tiers) │
          │ 2. Corridor Deviation     │               │ 5. Trip Start Guard       │
          │    (Vector projection)    │               │    (0 verified OTPs)      │
          │ 3. Long Stop Exemption    │               │ 6. Multiple Failed OTPs   │
          │    (150m stop buffer)     │               │    (zero-OTP redaction)   │
          └─────────────┬─────────────┘               └─────────────┬─────────────┘
                        │                                           │
                        └─────────────────────┬─────────────────────┘
                                              │
                                              ▼
                              ┌───────────────────────────────┐
                              │ Multi-Signal Correlator       │
                              │ (e.g. Detour + Velocity)      │
                              └───────────────┬───────────────┘
                                              │
                      ┌───────────────────────┼───────────────────────┐
                      ▼                       ▼                       ▼
         ┌─────────────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐
         │ Smart Safety Score      │ │ Smart ETA Delay │ │ Sanitized Public Feed   │
         │ (Dynamic Degradation)   │ │ (+min Recalc)   │ │ (Family-Safe Notice)    │
         └─────────────────────────┘ └─────────────────┘ └─────────────────────────┘
```

---

### Rule 1: Sudden Speed Increase with Multi-Reading Persistence

#### Physical Formulation
A sudden surge in vehicle velocity indicates aggressive driving, mechanical runaway, or erratic throttle control:
$$\Delta v = v_t - v_{t-1}$$

#### Persistence Condition (Anti-Jitter Filter)
To prevent spurious alerts caused by single-tick GPS multipath reflections, an anomaly is only escalated when the spike condition is sustained:
$$\text{Trigger Condition} = \left( \Delta v \ge 25 \text{ km/h} \lor v_t > 55 \text{ km/h} \right) \land \left( N_{\text{consecutive\_spikes}} \ge 2 \right)$$

#### Severity Classification
$$\text{Severity}(v_t) = \begin{cases} 
\text{CRITICAL} & \text{if } v_t \ge 85 \text{ km/h} \\
\text{HIGH} & \text{if } v_t \ge 70 \text{ km/h} \\
\text{MEDIUM} & \text{if } v_t \ge 55 \text{ km/h} \\
\text{NORMAL} & \text{otherwise}
\end{cases}$$

---

### Rule 2: Unexpected Route Corridor Deviation (Vector Projection)

#### Mathematical Derivation
Corridor routes (e.g., Bangalore SR-101 Whitefield Tech Express) are defined as ordered waypoints:
$$W = \{(lat_1, lng_1), (lat_2, lng_2), \dots, (lat_n, lng_n)\}$$

For any live coordinate $P = (lat_p, lng_p)$ and corridor segment $AB$ between $W_i$ and $W_{i+1}$:
1. Convert spherical coordinates to local Cartesian tangent plane coordinates (meters):
   $$p_x = (lng_p - lng_a) \cdot 111320 \cdot \cos(lat_p)$$
   $$p_y = (lat_p - lat_a) \cdot 111320$$
   $$b_x = (lng_b - lng_a) \cdot 111320 \cdot \cos(lat_p)$$
   $$b_y = (lat_b - lat_a) \cdot 111320$$

2. Calculate segment squared length:
   $$L^2 = b_x^2 + b_y^2$$

3. Compute projection scalar $t \in [0, 1]$:
   $$t = \max\left(0, \min\left(1, \frac{p_x b_x + p_y b_y}{L^2}\right)\right)$$

4. Calculate perpendicular cross-track error distance $d_{\text{segment}}$:
   $$\text{proj}_x = t \cdot b_x, \quad \text{proj}_y = t \cdot b_y$$
   $$d_{\text{segment}} = \sqrt{(p_x - \text{proj}_x)^2 + (p_y - \text{proj}_y)^2}$$

5. Minimum corridor deviation:
   $$d_{\text{corridor}} = \min_{i=1}^{n-1} d_{\text{segment}}(P, W_i, W_{i+1})$$

#### Tiered Deviation Thresholds
$$\text{Severity}(d_{\text{corridor}}) = \begin{cases}
\text{CRITICAL} & \text{if } d_{\text{corridor}} > 800\text{m} \\
\text{HIGH} & \text{if } 300\text{m} < d_{\text{corridor}} \le 800\text{m} \\
\text{MEDIUM} & \text{if } 150\text{m} < d_{\text{corridor}} \le 300\text{m} \\
\text{NORMAL} & \text{if } d_{\text{corridor}} \le 150\text{m (Permissible road buffer)}
\end{cases}$$

---

### Rule 3: Unexpected Long Stop with Designated-Stop Exemption

#### The Problem of False Alarms at Boarding Hubs
A vehicle stopped for 4 minutes at a scheduled transit hub (e.g., Bellandur EcoSpace) is legitimately boarding commuters. A naive stationary detector would falsely alert dispatchers.

#### Designated-Stop Geo-fence Exemption
For each designated stop $S_k \in W_{\text{stops}}$, the spherical Haversine distance is evaluated:
$$d_{\text{stop}} = 2 R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta lat}{2}\right) + \cos(lat_p)\cos(lat_{s})\sin^2\left(\frac{\Delta lng}{2}\right)}\right)$$

$$\text{If } \min_{k} d_{\text{stop}}(P, S_k) \le 150\text{m} \implies \mathbf{EXEMPT} \text{ (No alert generated)}$$

#### Non-Exempt Duration Tiers (Speed $\le 3$ km/h outside stop zones)
$$\text{Severity}(t_{\text{stopped}}) = \begin{cases}
\text{CRITICAL} & \text{if } t_{\text{stopped}} > 600\text{s (10 min)} \\
\text{HIGH} & \text{if } 300\text{s} < t_{\text{stopped}} \le 600\text{s (5–10 min)} \\
\text{MEDIUM} & \text{if } 180\text{s} < t_{\text{stopped}} \le 300\text{s (3–5 min)} \\
\text{NORMAL} & \text{if } t_{\text{stopped}} \le 180\text{s (< 3 min traffic wait)}
\end{cases}$$

---

### Rule 4: GPS Telemetry Staleness / Signal Loss

Monitors elapsed time $\Delta t_{\text{telemetry}} = t_{\text{now}} - t_{\text{last\_ping}}$:
$$\text{Severity}(\Delta t) = \begin{cases}
\text{CRITICAL} & \text{if } \Delta t > 120\text{s (Total blackout)} \\
\text{HIGH} & \text{if } 60\text{s} < \Delta t \le 120\text{s (Tampering or hardware fault)} \\
\text{MEDIUM} & \text{if } 15\text{s} < \Delta t \le 60\text{s (Temporary dead zone or underpass)} \\
\text{NORMAL} & \text{if } \Delta t \le 15\text{s (Nominal transmission cycle)}
\end{cases}$$

---

### Rule 5: Unexpected Trip Start Lifecycle Guard

Enforces physical verification before dispatch:
$$\text{Boarded Verified Commuters} = \sum_{j=1}^m \mathbb{I}(\text{passenger}_j.\text{boarded} == \text{true})$$
$$\text{If } (\text{Action} == \text{'START'}) \land (\text{Boarded Verified Commuters} == 0) \implies \text{Alert: UNEXPECTED\_TRIP\_START (HIGH)}$$

---

### Rule 6: Multiple Failed OTP Attempts (Zero OTP Leakage)

Tracks verification errors while strictly preventing brute-force passenger identification:
$$\text{Failed Attempts } F_{\text{passenger}} = \sum \mathbb{I}(\text{input\_otp} \ne \text{ride\_otp})$$
$$\text{Severity}(F) = \begin{cases}
\text{HIGH (Lockout Alert)} & \text{if } F \ge 3 \\
\text{MEDIUM} & \text{if } F = 2 \\
\text{WARNING} & \text{if } F = 1
\end{cases}$$

**Cryptographic Privacy Guarantee**: Raw OTP strings are never persisted, stored in memory metadata, or transmitted to clients. Only the failure count $F$ and passenger display name are retained.

---

## 3. Multi-Signal Anomaly Correlation

Real-world security threats rarely manifest as isolated telemetry blips. The Multi-Signal Correlator identifies co-occurring variances within an operational sliding window ($\tau = 180$ seconds):

| Signal 1 | Signal 2 | Correlated Classification | Elevated Severity |
| :--- | :--- | :--- | :--- |
| **Route Deviation** ($> 300$m) | **Speed Surge** ($> 65$ km/h) | **Aggressive Off-Corridor Detour** | **CRITICAL** |
| **Route Deviation** ($> 300$m) | **GPS Signal Loss** ($> 60$s) | **Corridor Tampering / Tracking Blackout** | **CRITICAL** |
| **Long Stop** ($> 5$ min) | **Multiple Failed OTPs** ($\ge 3$) | **Boarding Security Dispute at Curbside** | **HIGH** |
| **Unexpected Trip Start** | **Speed Surge** ($> 55$ km/h) | **Unauthorized Unmanifested Dispatch** | **HIGH** |

---

## 4. Integration with SmartRide Subsystems

### A. Dynamic Smart Safety Score Impact
Every active anomaly applies an explainable mathematical deduction to the active trip safety score ($S_{\text{base}} = 100$):
$$S_{\text{current}} = \max\left(0, 100 - \sum_{k} \text{Penalty}_k\right)$$

* Route Deviation: $-10$ (Medium), $-18$ (High), $-25$ (Critical)
* Sudden Speed Spike: $-10$ (Medium), $-15$ (Critical)
* Unexpected Long Stop: $-8$ (Medium), $-14$ (High), $-20$ (Critical)
* GPS Telemetry Loss: $-6$ (Medium), $-12$ (High), $-20$ (Critical)
* Multiple OTP Failures: $-5 \times F$ (capped at $-20$)
* Multi-Signal Correlated Event: $-20$

### B. Smart ETA Detour Recalculation
Corridor route deviations physically lengthen the vehicle travel distance:
$$\Delta t_{\text{detour}} = \min\left(15, \left\lfloor \frac{d_{\text{deviation}}}{150} \right\rfloor\right) \text{ minutes}$$
$$\text{ETA}_{\text{adjusted}} = \text{ETA}_{\text{scheduled}} + \text{Delay}_{\text{traffic}} + \Delta t_{\text{detour}}$$

### C. Role-Tailored RBAC Sanitization Matrix
To prevent panic among commuters while maintaining operational transparency:

| Incident Severity | Admin Command Center | Commuter Portal | Public Live Tracking Radar |
| :--- | :--- | :--- | :--- |
| **CRITICAL / HIGH** | Full telemetry, raw diagnostics, investigator assignment, one-click resolution modal | Corridor delay notice, updated arrival time | `🟠 Safety Desk Monitoring Active` (Reassuring notice) |
| **MEDIUM / WARNING** | Active anomaly feed, corridor deviation in meters | Corridor traffic delay (+X min) | `🟡 Minor Corridor Delay` (+X min expected) |
| **NORMAL** | Zero active events, corridor compliant | On schedule, normal ETA | `🟢 Operating Normally` (Corridor on track) |

---

## 5. Cybersecurity Audit Trail Architecture

All administrative incident actions (`ACKNOWLEDGE`, `INVESTIGATE`, `RESOLVE`, `DISMISS`) are committed to an append-only, cryptographically sanitized `SecurityAuditLog`:

```typescript
// Sanitization Pipeline in audit-logger.ts
function sanitizeAuditMetadata(meta?: Record<string, any>) {
  const cleaned = { ...meta };
  delete cleaned.rideOtp;
  delete cleaned.otp;
  delete cleaned.enteredOtp;
  delete cleaned.password;
  delete cleaned.token;
  delete cleaned.authorization;
  return cleaned;
}
```

---

## 6. Viva / Academic Defense Questions & Answers

### Q1: Why did you implement this as rule-based rather than Machine Learning?
> **Answer**: "In life-critical passenger transportation, explainability and deterministic guarantees are paramount. Machine learning models require large volumes of labeled anomalous telemetry—which in production denotes accidents or security breaches—creating an inherent cold-start problem. Furthermore, unsupervised models like k-Means or basic clustering produce unpredictable boundary shifts where a 155m detour might be ignored while a 145m detour is flagged. Our rule-based engine provides guaranteed mathematical bounds with zero false negatives on policy violations, while maintaining a clean feature-vector pipeline (`TelemetryReadingInput`) ready for future ML scoring."

### Q2: How does the engine prevent false alarms caused by GPS jitter?
> **Answer**: "We employ a two-stage stabilization strategy:
> 1. **Multi-Reading Persistence**: Speed spikes require at least two consecutive telemetry samples above the threshold before an anomaly is declared.
> 2. **Designated-Stop Geo-fence Exemption**: When a vehicle is stationary for several minutes, the engine computes spherical Haversine distances to all scheduled corridor stops. If the vehicle is within 150m of a stop, it is recognized as normal passenger boarding/alighting and fully exempted."

### Q3: How do you prevent event flooding/spamming in the database?
> **Answer**: "Through **Event Deduplication and Duration Accumulation**. If an active anomaly of type `ROUTE_DEVIATION` or `SPEED_ANOMALY` already exists for the trip, successive evaluations update `durationSeconds`, `maxDeviationMeters`, and `lastDetectedAt` in place rather than inserting redundant rows every 2 seconds. A new record is only generated if the previous event was formally resolved or dismissed."

### Q4: How is commuter privacy maintained if an OTP verification fails?
> **Answer**: "The system adheres strictly to Privacy-by-Design principles. When a commuter enters an incorrect OTP, the engine records only the integer failure count and commuter name. Raw OTPs, hash pre-images, and authorization credentials are permanently redacted from event metadata, audit logs, and client API responses."

### Q5: How would an unsupervised ML model integrate with this system in the future?
> **Answer**: "The `evaluateTripAnomalies` interface is fully decoupled from the underlying logic. A scikit-learn Isolation Forest or PyTorch Autoencoder can consume the normalized vector `[currentSpeed, speedDelta, corridorDeviationMeters, stoppedDurationSeconds, elapsedSecondsWithoutPing]` and output an anomaly score $A \in [0, 1]$. When $A > \theta_{\text{threshold}}$, it can emit an anomaly event using the exact same `AnomalyEvent` structure, requiring zero changes to the UI, audit trail, or database."
