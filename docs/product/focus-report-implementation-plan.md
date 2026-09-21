# Focus Report Implementation Plan (v0 Shadow Mode)

> **Document Status:** Maintainer Implementation Blueprint  
> **Primary Product Focus:** Read-Only Shadow Mode & Focus Report v0  
> **Target Audience:** Core Maintainers & Design Partners  

---

## 1. Current Repository Mapping

| Focus Report Concept | Existing Repository Component | Strategy / Action |
| :--- | :--- | :--- |
| **User & Authentication** | `User`, `Account`, `Session` (`apps/api/prisma/schema.prisma`) | **Reuse.** Existing JWT authentication and user management handles user accounts. |
| **Connected Accounts** | `Account` model in Prisma | **Extend.** Add integration metadata fields (`providerId: "slack" | "google"`) and OAuth token storage. |
| **Focus State Inference** | `ContextSnapshot` model | **Extend / Adapt.** Create pure domain function in `packages/shared` (`inferFocusState`) mapping calendar & activity fixtures to `FocusState`. |
| **Interruption Record** | `Event` model | **Map.** `Event` model cleanly holds normalized interruption events. Derive metadata features (`mentionType`, `hasUrgencySignal`) at ingest. |
| **Shadow Policy Decision** | `Decision` & `DecisionExplanation` | **Map.** Counterfactual decision outcomes (`DELIVER`, `DELAY_TO_MEETING_END`, `DELAY_TO_BOUNDARY`, `BATCH`) map to `Decision` with `policyVersion: "shadow-v0.1"`. |
| **Decision Review Queue** | `Feedback` model | **Map.** User review answers (`"hurt"` | `"fine"` | `"unsure"`) map to `Feedback` model (`userAction: "OVERRIDDEN" | "ACCEPTED"`). |
| **Report Metrics Engine** | `AnalyticsRollup` model / `apps/api/src/modules/analytics` | **New pure module.** Create `FocusReportCalculator` in `packages/shared` to calculate report metrics. |

---

## 2. Product Assumptions & Heuristics

1. **Focus State Heuristic (`inferFocusState`):**
   - Evaluated at 1-minute resolution using priority matching: `ooo` > `meeting` > `focus_block` > `quiet_window` > `available`.
2. **`quiet_window` Proxy (Renamed from `deep_gap`):**
   - 45+ consecutive minutes with no calendar meetings and no outgoing Slack activity is classified as `quiet_window` (a proxy for undisturbed work, explicitly labeled as an inference, not a guarantee of flow).
3. **Recovery Exposure Constant:**
   - Default assumption of 23 minutes of attention residue recovery per focus-time interruption (derived from Mark et al. interruption studies), clearly labeled as a user-configurable assumption.

---

## 3. External Permission Findings

- **Slack:** Minimum required scopes are `channels:history`, `groups:history`, `im:history`, `mpim:history`, `users:read`. Raw message text is processed in memory to extract metadata features (`hasUrgencySignal`, `mentionType`), then immediately erased before database storage.
- **Google Calendar:** Minimum scope is `calendar.events.readonly`. Event summaries are processed in memory to determine meeting attendee count and event type, then erased before persisting `DerivedCalendarBlock`.

---

## 4. Privacy Architecture & Data Ingestion Boundary

```
Incoming Webhook / API Payload
             │
             ▼
┌──────────────────────────────────────────┐
│ Ingestion Layer (Memory-Only Parser)     │
│ - Raw Message Text / Event Titles        │
└────────────┬─────────────────────────────┘
             │ (Extract Allowlist Features Only)
             ▼
┌──────────────────────────────────────────┐
│ Erase & Discard Raw Content              │
└────────────┬─────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────┐
│ Normalized Domain Record (Persisted)     │
│ - userId, receivedAt, channelType        │
│ - mentionType, senderTier, urgencySignal │
│ - slackPermalink (Slack Deep Link)       │
└──────────────────────────────────────────┘
```

---

## 5. Domain Model

```typescript
export type FocusState = 'ooo' | 'meeting' | 'focus_block' | 'quiet_window' | 'available';

export type PolicyOutcome = 'DELIVER' | 'DELAY_TO_MEETING_END' | 'DELAY_TO_BOUNDARY' | 'BATCH';

export type PolicyVersion = 'shadow-v0.1';

export type ReasonCode =
  | 'NEVER_SUPPRESS_VIP'
  | 'NEVER_SUPPRESS_INCIDENT'
  | 'STATE_AVAILABLE'
  | 'STATE_OOO_BOUNDARY'
  | 'DIRECT_MENTION_URGENT'
  | 'MEETING_DELAY_TO_END'
  | 'FOCUS_BLOCK_BATCH_CHANNEL'
  | 'FOCUS_BLOCK_DELAY_BOUNDARY'
  | 'QUIET_WINDOW_DELAY_BOUNDARY';
```

---

## 6. Shadow Policy (Pure Function Specification)

```typescript
export function evaluateShadowPolicy(
  interruption: InterruptionRecord,
  focusState: FocusState,
  config: UserSettings
): ShadowDecision {
  // 1. Never-suppress VIP check
  if (config.vipUserIds.includes(interruption.senderId) || interruption.senderTier === 'vip') {
    return {
      outcome: 'DELIVER',
      reasonCode: 'NEVER_SUPPRESS_VIP',
      policyVersion: 'shadow-v0.1',
      wouldDeliverAt: interruption.receivedAt,
    };
  }

  // 2. Incident channel check
  if (interruption.channelType === 'public' && interruption.isIncidentChannel) {
    return {
      outcome: 'DELIVER',
      reasonCode: 'NEVER_SUPPRESS_INCIDENT',
      policyVersion: 'shadow-v0.1',
      wouldDeliverAt: interruption.receivedAt,
    };
  }

  // 3. State is available or OOO boundary
  if (focusState === 'available') {
    return {
      outcome: 'DELIVER',
      reasonCode: 'STATE_AVAILABLE',
      policyVersion: 'shadow-v0.1',
      wouldDeliverAt: interruption.receivedAt,
    };
  }

  if (focusState === 'ooo') {
    return {
      outcome: 'DELIVER',
      reasonCode: 'STATE_OOO_BOUNDARY',
      policyVersion: 'shadow-v0.1',
      wouldDeliverAt: interruption.receivedAt,
    };
  }

  // 4. Direct mention / DM with urgency signal
  if ((interruption.mentionType === 'direct' || interruption.channelType === 'dm') && interruption.hasUrgencySignal) {
    return {
      outcome: 'DELIVER',
      reasonCode: 'DIRECT_MENTION_URGENT',
      policyVersion: 'shadow-v0.1',
      wouldDeliverAt: interruption.receivedAt,
    };
  }

  // 5. State is meeting
  if (focusState === 'meeting') {
    return {
      outcome: 'DELAY_TO_MEETING_END',
      reasonCode: 'MEETING_DELAY_TO_END',
      policyVersion: 'shadow-v0.1',
      wouldDeliverAt: interruption.meetingEndAt || interruption.receivedAt,
    };
  }

  // 6. Focus block or quiet window with @channel/@here
  if ((focusState === 'focus_block' || focusState === 'quiet_window') && 
      (interruption.mentionType === 'channel' || interruption.mentionType === 'here')) {
    return {
      outcome: 'BATCH',
      reasonCode: 'FOCUS_BLOCK_BATCH_CHANNEL',
      policyVersion: 'shadow-v0.1',
      wouldDeliverAt: interruption.nextBatchWindowAt || interruption.receivedAt,
    };
  }

  // 7. Otherwise in focus block or quiet window
  return {
    outcome: 'DELAY_TO_BOUNDARY',
    reasonCode: focusState === 'focus_block' ? 'FOCUS_BLOCK_DELAY_BOUNDARY' : 'QUIET_WINDOW_DELAY_BOUNDARY',
    policyVersion: 'shadow-v0.1',
    wouldDeliverAt: interruption.nextFocusBoundaryAt || interruption.receivedAt,
  };
}
```

---

## 7. Focus-State Inference Architecture

`inferFocusState` is a pure function operating on normalized calendar blocks and activity timestamps:
- Input: `CalendarBlock[]`, `lastActivityTimestamp`, `now`, `UserSettings`.
- Output: `FocusState`.
- Guaranteed priority order: `ooo` $\rightarrow$ `meeting` $\rightarrow$ `focus_block` $\rightarrow$ `quiet_window` $\rightarrow$ `available`.

---

## 8. Replay Simulator Architecture

```
Normalized Event Fixtures (JSON) ──┐
                                   ├─► Replay Simulator Core ──► Metrics & Focus Report
Normalized Calendar Timeline ──────┤   (Pure Functions Only)
                                   │
User Configuration Settings ───────┘
```

The Replay Simulator uses the exact same `evaluateShadowPolicy` and `calculateFocusReportMetrics` functions used by live shadow mode, ensuring 100% policy identity.

---

## 9. Metrics Definitions & Classification

| Metric | Type | Formula / Source |
| :--- | :--- | :--- |
| **Total Interruptions** | **MEASURED** | Count of inbound Slack notifications |
| **State Distribution** | **MEASURED** | Count of arrivals during each `FocusState` |
| **Policy Outcome Breakdown** | **DERIVED** | Count of `would-deliver`, `would-delay`, `would-batch` |
| **Estimated Avoidable Share** | **DERIVED** | `(would-delay + would-batch) / total` |
| **Adjusted Avoidable Share** | **DERIVED** | Excludes items marked `"hurt"` in review queue |
| **Fragmentation Score** | **DERIVED** | Median length (minutes) of uninterrupted available gaps |
| **Longest Protected Block** | **DERIVED** | Max continuous stretch without delivered interruption |
| **Estimated Recovery Exposure**| **ESTIMATED** | `interruptionsInFocus * recoveryMinutesAssumption` |
| **Critical-Delay Rate** | **DERIVED** | `(reviewed "hurt") / (reviewed total)` |
| **Team @channel Cost** | **ESTIMATED** | `sum(recipients * perInterruptionCost)` |

---

## 10. Label Architecture & Review Queue

- Sample up to **20 counterfactual delay decisions** per two-week period.
- User review options: `"hurt"` | `"fine"` | `"unsure"`.
- Labels store `policyVersion`, `decisionId`, `reasonCode`, `focusState`, and user verdict for benchmark evaluation.

---

## 11. Policy Versioning

All decisions tag `policyVersion: "shadow-v0.1"`. Replaying historical fixtures against future policy versions (`shadow-v0.2`, `attention-engine-v1`) allows precise regression testing.

---

## 12. Minimum Persistence Model

- Uses existing Prisma tables (`User`, `Account`, `Event`, `Decision`, `Feedback`) without creating unnecessary duplicate tables.

---

## 13. Testing Strategy

1. **Unit Tests:** Pure function tests for `evaluateShadowPolicy`, `inferFocusState`, and `calculateFocusReportMetrics`.
2. **Scenario Tests:** Scenarios A through J (VIP bypasses, meeting delays, `@channel` batching, metrics adjustment).
3. **Privacy Tests:** Schema and memory scan verifying zero message body persistence.

---

## 14. Phase-0 Implementation Completed

- Pure domain types & policy versioning in `packages/shared/src/focus-report/types.ts`.
- Pure shadow policy engine in `packages/shared/src/focus-report/policy.ts`.
- Focus state inference engine in `packages/shared/src/focus-report/focus-state.ts`.
- Replay simulator engine in `packages/shared/src/focus-report/simulator.ts`.
- Focus Report metrics calculator in `packages/shared/src/focus-report/metrics.ts`.
- Comprehensive Vitest unit test suite in `packages/shared/test/focus-report.test.ts`.

---

## 15. Next Implementation Step

- Implement production OAuth flow handlers for Slack and Google Calendar in `apps/api`.

---

## 16. Explicitly Deferred Work

- Full Attention Debt equations, Qdrant/pgvector integration, live message blocking/delaying, IDE plugins, LLM decision wrappers.
