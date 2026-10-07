# 🎮 SmartRide Commute Gamification & Achievements Engine

## Executive Overview
The **SmartRide Gamification & Achievements Engine** is an engagement and positive behavioral reinforcement system integrated into the SmartRide (CommuteSync) enterprise shuttle platform. It rewards positive, reliable, and sustainable commuting habits through verified XP awards, progressive levels, multi-category badges, on-time streaks, and monthly privacy-safe leaderboards.

---

## 1. Gamification Objectives & Fair Play Commitment
The primary goal is to encourage punctual boarding, prompt OTP security validation, and consistent shared transit usage across urban corridors.

> **Strict Anti-Gaming Guarantee**:
> Gamification in SmartRide **rewards positive commuting behavior and does NOT reward unnecessary trip volume**.
> - Zero points for initiating, booking, or cancelling subscriptions.
> - Points are awarded strictly upon verified completed physical trips.
> - Cancelled, failed, or simulated duplicate trips award **0 XP**.
> - Failed OTP code attempts generate **0 XP**.
> - High-prestige badges enforce **minimum sample size gating** (e.g., $\ge 10$ trips) to prevent single-trip instant unlocks.

---

## 2. XP / Point System (`src/lib/gamification/points-config.ts`)

All point values are centralized and auditable:
- **Completed Shared Trip**: `+25 XP`
- **OTP-Verified Boarding**: `+15 XP`
- **On-Time Boarding**: `+10 XP`
- **Monthly Consistency Bonus**: `+100 XP` (completing $\ge 15$ commute days in a calendar month)
- **Sustainability $\text{CO}_2$ Milestone**: `+50 XP` (per 10 kg $\text{CO}_2\text{e}$ avoided milestone)
- **Consecutive Streak Bonus**: `+50 XP` (every 5 consecutive on-time trips)

---

## 3. Idempotent XP Event Ledger
Every XP award writes an auditable record to the `XPEvent` table with a unique composite key:
$$\text{idempotencyKey} = \text{userId} : \text{eventType} : \text{sourceId}$$

*Examples*:
- `usr-rahul:COMPLETED_TRIP:trip-sr101-20260917-am`
- `usr-rahul:OTP_BOARDING:att-rahul-20260917-am`
- `usr-rahul:ACHIEVEMENT_UNLOCKED:ach-green-commuter`

If a page reloads, an API is retried, or a server restarts, the unique constraint strictly prevents double-awarding XP.

---

## 4. Deterministic Level Mathematics
Levels are purely derived from cumulative lifetime XP:
$$\text{Level}(XP) = \left\lfloor \frac{XP}{250} \right\rfloor + 1$$
$$\text{CurrentBaseXP} = (\text{Level} - 1) \times 250$$
$$\text{NextLevelXP} = \text{Level} \times 250$$
$$\text{ProgressPercent} = \frac{XP - \text{CurrentBaseXP}}{250} \times 100$$

- Level 1: $0$ – $249$ XP
- Level 2: $250$ – $499$ XP
- Level 3: $500$ – $749$ XP
- Level 7: $1,500$ – $1,749$ XP ($1,620\text{ XP} \rightarrow \text{Level 7, 48\% progress}$).

---

## 5. On-Time Boarding & Smart Delay Forgiveness
$$\text{Streak} = \text{Consecutive On-Time Eligible Trips}$$

- **On-Time Window**: Commuter arrives within $\le 3\text{ minutes}$ of the scheduled stop pickup time.
- **Smart Delay Forgiveness**: If the shuttle vehicle is delayed due to traffic or driver dispatch ($\text{Smart ETA delay} > 0$), the commuter's allowed boarding window is automatically expanded by the delay duration:
  $$\text{AllowedBoardingTime} = \text{ScheduledPickup} + \text{DelayMinutes} + 3\text{ min}$$
  *Commuters are never penalized for corridor congestion or driver delays.*
- **System Cancellation Protection**: Trips cancelled by SmartRide preserve active streaks rather than resetting them to zero.

---

## 6. Achievement Categories (14 Badges)

1. **🌱 Sustainability**:
   - `ach-eco-explorer`: 10 kg $\text{CO}_2\text{e}$ avoided (+75 XP)
   - `ach-eco-saver`: 30 kg $\text{CO}_2\text{e}$ avoided (+150 XP)
   - `ach-planet-champion`: 75 kg $\text{CO}_2\text{e}$ avoided (+300 XP)
2. **🚌 Consistency**:
   - `ach-first-mile`: 1 completed shared trip (+25 XP)
   - `ach-regular-rider`: 10 completed shared trips (+50 XP)
   - `ach-green-commuter`: 20 completed shared trips (+100 XP)
   - `ach-consistent-commuter`: 15 commute days in a calendar month (+100 XP)
3. **⏱ Reliability**:
   - `ach-punctual-pioneer`: 5 on-time boardings (+50 XP)
   - `ach-route-champion`: $\ge 95\%$ on-time rate ($\ge 10$ trip minimum sample size) (+150 XP)
   - `ach-streak-master`: 10 consecutive on-time boardings (+100 XP)
4. **🔐 Safety**:
   - `ach-security-conscious`: 5 verified OTP boardings (+50 XP)
   - `ach-verified-rider`: 10 verified OTP boardings (+100 XP)
   - `ach-zero-fail-star`: 25 verified OTP boardings with 0 failed attempts (+200 XP)
5. **🏆 Milestones**:
   - `ach-century-club`: 100 total completed trips (+500 XP)

---

## 7. Monthly Leaderboard & Privacy Protection
- **Monthly Scope**: Ranks riders based on XP earned within the active calendar month (e.g. September 2026).
- **Persistent Progress**: Unlocked achievements and lifetime levels **never disappear** when the month resets.
- **Privacy Controls**:
  - Commuters can toggle `showOnLeaderboard` on/off.
  - Display name options: `REAL_NAME`, `INITIALS` (e.g. `R**** V`), or `ANONYMOUS` (e.g. `Commuter #104`).
- **Data Protection**: Zero PII (emails, phone numbers, home locations) is ever transmitted in leaderboard payloads.

---

## 8. Database Architecture (`prisma/schema.prisma`)
- `GamificationProfile`: Stores `totalXP`, `currentStreak`, `bestStreak`, `showOnLeaderboard`, and `privacyDisplayName`.
- `Achievement`: Canonical definitions with metric thresholds, sample sizes, and XP rewards.
- `UserAchievement`: Tracks per-commuter progress, unlocked timestamps, and notification state.
- `XPEvent`: Immutable, auditable ledger with unique `idempotencyKey`.

---

## 9. API Endpoints
- `GET /api/commuter/gamification`: Full profile, stats, streak, level, and personal records.
- `GET /api/commuter/gamification/achievements`: Categorized achievement progress.
- `POST /api/commuter/gamification/privacy`: Commuter privacy preferences toggle.
- `GET /api/gamification/leaderboard`: Monthly corridor rankings.
- `GET /api/admin/gamification`: Fleet engagement KPIs, popular badges, and XP event ledger.

---

## 10. Verification & Test Suite
- **Dedicated Test Suite** (`scripts/test-gamification.ts`): **27 / 27 tests passed (100%)**.
- **Full Regression**:
  - Sustainability Engine: **35 / 35 passed**.
  - Driver No-Show & Contingency: **36 / 36 passed**.
  - Seat Optimization: **33 / 33 passed**.
  - Safe Arrival: **25 / 25 passed**.
  - Anomaly Detection: **36 / 36 passed**.
  - Safety Score: **23 / 23 passed**.
- **TypeScript & Build**: 0 errors (`npx tsc --noEmit`), 32/32 routes compiled in production build.
