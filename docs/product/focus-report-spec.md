# Focus Report: Shadow-Mode Spec (v0)

> **Suggested Path:** `docs/product/focus-report-spec.md`  
> **Status:** Draft for Review  
> **Goal:** Define the smallest product that tells us whether anyone cares about InterruptIQ before building the full attention engine.  

---

## 1. Why This Exists

The architecture audit produced a strong model (Net Utility, Attention Debt, Optimal Timing), but nobody has validated that engineering teams will connect their tools, trust the output, or pay for it.

The **Focus Report** is a read-only, shadow-mode product. It connects to Slack and Google Calendar, watches for two weeks, and never delivers, delays, or suppresses anything. At the end, it answers one question:

> *"If InterruptIQ had been running, how many interruptions would you have avoided, what would it have delayed, and would it have delayed anything that mattered?"*

It doubles as onboarding, sales pitch, evaluation dataset, and label-collection mechanism.

---

## 2. Hypotheses Being Tested

| # | Hypothesis | How We Test It |
|---|---|---|
| **H1** | Engineers will grant read access to Slack and Calendar metadata | Connection rate among invited design partners |
| **H2** | A meaningful share of interruptions are avoidable without harm | Estimated avoidable share, confirmed by user review (Section 7) |
| **H3** | The report is compelling enough to change behavior or budget | "Would you turn this on live?" and "Would you pay?" answers |
| **H4** | A simple heuristic captures most of the value | Compare heuristic policy vs. user-corrected labels |

---

## 3. Success and Kill Criteria

Set these before the first partner runs. Adjust the numbers if needed before testing, but **do not adjust them after seeing results**.

### Success Signals (Proceed to Live Mode):
- At least **60%** of invited partners complete connection.
- At least **5 partners** receive a full report.
- At least **2 partners** ask to turn on live mode unprompted.
- Reviewed **critical-delay rate is under 2%** of would-be-delayed items (Section 6.4).

### Kill or Pivot Signals:
- Fewer than **30%** of invited partners will connect (privacy barrier too high).
- Partners read the report but **no one asks for live mode** (it's entertainment, not a product).
- Reviewed **critical-delay rate above 10%** (the heuristic is not safe enough to ship).

---

## 4. Non-Goals

- No live delivery, delaying, batching, or suppression.
- No IDE, screen, keystroke, or app-usage tracking.
- No individual-level views for managers. **Ever.**
- No LLM calls on the per-event path.
- No GitHub, Jira, or PagerDuty in v0 (add only after Slack + Calendar prove out).
- No learned models. v0 is heuristics; learning starts once labels exist.

---

## 5. Inputs and Permissions

### 5.1 Google Calendar (read-only)
- **Scope:** `calendar.readonly` (or `calendar.events.readonly`).
- **Fields used:** `start`, `end`, `attendee count`, `response status`, `busy/free`, `recurring flag`, and whether the event is titled/marked as a focus block.
- Event titles and descriptions are **not stored**. We keep only a derived kind: `meeting`, `focus_block`, `ooo`, `other`.

### 5.2 Slack (read, metadata-first)
- Use minimum scopes to observe: message timestamp, channel type (`dm`, `group_dm`, `private`, `public`), whether the user was directly `@-mentioned`, whether the message was `@channel`/`@here`, thread participation, and whether/when the user replied.
- **Message bodies are not stored by default.** Compute features at ingest (mention type, `has-urgency-keyword`, sender is frequent contact) and discard the text.
- *Open Question:* Slack's scope model may force broader access than desired. Confirm minimum scopes early; this is the highest-risk integration detail.

### 5.3 Consent Model
- Each person connects their own account. No admin-only bulk ingest in v0.
- Users see exactly what is collected, can pause, and can delete all data with one action.
- Team-level aggregates are shown **only when the group has 5 or more consenting members**.

---

## 6. Computation

### 6.1 Focus State Inference (v0 Heuristic)
For each user and time slice (1-minute resolution), assign one state (first match wins):
1. `ooo`: Calendar out-of-office, or outside the user's configured working hours.
2. `meeting`: Calendar meeting with 2 or more attendees where the user accepted or is the organizer.
3. `focus_block`: Calendar event marked as focus, or user-defined recurring focus window.
4. `deep_gap`: 45 or more consecutive minutes with no meetings and no outgoing Slack activity. (Proxy for flow).
5. `available`: Everything else.

*Working hours default to 09:00 to 18:00 local time and are user-editable.*  
*Limitation:* We cannot see whether someone is actually in flow. Every report explicitly states this.

### 6.2 Interruption Events
An interruption is any inbound Slack message that could plausibly produce a notification for the user:
- Direct message or group DM
- Direct `@-mention`
- `@channel` / `@here` in a channel the user belongs to
- Reply in a thread the user participated in

*Channel chatter the user did not get notified about is not counted.*

### 6.3 Counterfactual Policy (What We Would Have Done)
For each interruption, apply in order:
1. **Never-suppress list $\rightarrow$ `DELIVER`:** DMs from manager and configured VIPs, messages in incident/on-call channels, and paging integrations.
2. **State is `available` or `ooo-boundary` $\rightarrow$ `DELIVER`**.
3. **Direct mention or DM with urgency signal** (keyword or question + deadline pattern) $\rightarrow$ **`DELIVER`**.
4. **State is `meeting` $\rightarrow$ `DELAY_TO_MEETING_END`**.
5. **State is `focus_block` or `deep_gap` and message is `@channel`/`@here` or low-signal $\rightarrow$ `BATCH`** into the next natural boundary or batch window.
6. **Otherwise in `focus_block` or `deep_gap` $\rightarrow$ `DELAY_TO_BOUNDARY`**.

*There is no `SUPPRESS` outcome in v0.* Everything is delivered eventually; the report measures how much later. Each decision stores a `reasonCode`.

### 6.4 Safety Metric: Critical-Delay Rate
v0 estimates ground truth in two ways:
- **Proxy signal:** User replied to the message within 5 minutes while our policy would have delayed it.
- **User review (Primary):** Show the user up to 20 sampled would-be-delayed messages (Slack deep link only; body not stored) and ask: *"Would a delay have hurt?"* (Yes / No / Not sure).

$$\text{critical\_delay\_rate} = \frac{\text{reviewed "Yes"}}{\text{reviewed total}}$$

### 6.5 Metrics in the Report

| Metric | Definition |
|---|---|
| **Total interruptions** | Count from Section 6.2 |
| **Interruptions by State** | Counts during `meeting`, `focus_block`, `deep_gap` |
| **Policy Breakdown** | Counts for `would-deliver`, `would-delay`, `would-batch` |
| **Estimated avoidable share** | `(would-delay + would-batch) / total` |
| **Adjusted avoidable share** | Excludes items marked "Yes, a delay would hurt" in review |
| **Fragmentation score** | Median length of uninterrupted available time between interruptions |
| **Longest protected block** | Longest stretch with no delivered interruption (policy vs. actual) |
| **Estimated recovery cost** | Interruptions during `focus_block`/`deep_gap` $\times$ recovery minutes (default 23) |
| **Critical-delay rate** | Calculated from Section 6.4 |
| **Team `@channel` cost** | Sum over `@channel`/`@here` of recipients $\times$ per-interruption cost (engineer-hours) |

---

## 7. Report Structure

### Personal Report (Private to the user):
1. **Headline:** e.g. *"You had 214 interruptions; roughly 96 could have waited without harm."*
2. **Your week at a glance:** Timeline heatmap of focus state vs. interruption arrivals.
3. **What we'd have changed:** Breakdown of `would-deliver` / `delay` / `batch` with top reason codes.
4. **Review queue:** 20 sampled delay decisions (Section 6.4).
5. **Adjusted results after review.**
6. **Assumptions panel:** Editable parameters (recovery minutes, working hours) with instant recompute.
7. **Call to action:** *"Turn on live mode"* (disabled in v0; captures interest) + 2-question survey.

### Team Report (Requires $\ge 5$ consenting members):
- Aggregate avoidable share, `@channel` cost in engineer-hours, busiest interruption hours, meeting-fragmentation patterns.
- **No per-person breakdown, no rankings, no individual names.**

---

## 8. Data Model (TypeScript Sketch)

```typescript
type FocusState = 'ooo' | 'meeting' | 'focus_block' | 'deep_gap' | 'available';

type PolicyOutcome =
  | 'DELIVER'
  | 'DELAY_TO_MEETING_END'
  | 'DELAY_TO_BOUNDARY'
  | 'BATCH';

interface InterruptionRecord {
  id: string;
  userId: string;
  receivedAt: string;            // ISO 8601
  source: 'slack';
  channelType: 'dm' | 'group_dm' | 'private' | 'public';
  mentionType: 'direct' | 'channel' | 'here' | 'thread_reply';
  senderTier: 'vip' | 'frequent' | 'other';
  hasUrgencySignal: boolean;     // computed at ingest; text discarded
  slackPermalink: string;        // for user review only
  stateAtArrival: FocusState;
  outcome: PolicyOutcome;
  reasonCode: string;
  wouldDeliverAt: string;        // ISO 8601
  userRepliedWithinSec?: number;
  review?: 'hurt' | 'fine' | 'unsure';
}

interface FocusReport {
  userId: string;
  periodStart: string;
  periodEnd: string;
  assumptions: {
    recoveryMinutes: number;     // default 23
    workingHours: { start: string; end: string; tz: string };
    urgencyKeywords: string[];
    vipUserIds: string[];
  };
  metrics: Record<string, number>;
  generatedAt: string;
}
```

---

## 9. Codebase Mapping

Based on the architecture audit:
- **New:** Ingestion adapters for Slack and Calendar, focus-state module, shadow-policy module, report generator.
- **Reuse:** Existing `Event` and `Decision` types where appropriate; React simulator can render the timeline and review queue.
- **Do not build yet:** Full Net Utility engine, Attention Debt decay, or Redis scheduling. The shadow policy is intentionally a simple, readable rule table.
- **Replay simulator:** Pure function policy: `(event, state, config) => decision` to run on live shadow data or exported JSON.
- **Async work:** Ingestion and report generation run asynchronously via background workers, never blocking request handlers.

---

## 10. Privacy and Trust Requirements

- Store metadata and derived features only; **no message bodies or calendar titles**.
- One-click pause and full delete.
- **Data retention:** Raw records deleted 30 days after report delivery unless user opts in.
- No manager or admin access to any individual report.
- Team view enforces 5-member minimum strictly in code.
- Plain-language *"What We Collect"* page published prior to partner connections.

---

## 11. Two-Week Build Plan

### Week 1
- **Days 1–2:** Confirm minimum Slack scopes; Calendar OAuth; store consent & settings.
- **Days 3–4:** Calendar sync & focus-state inference with unit tests on fixture calendars.
- **Day 5:** Slack ingestion producing `InterruptionRecord` features (no message bodies).

### Week 2
- **Days 6–7:** Shadow policy as a pure function; replay over 1 week of internal team data.
- **Day 8:** Metrics and report generation.
- **Day 9:** Review queue & adjusted results calculation.
- **Day 10:** Assumptions panel, delete/pause, *"What We Collect"* page; dogfood on internal team.

**Definition of Done:** Run the report on your own workspace, read the output honestly, and answer whether you would turn it on live.

---

## 12. Acceptance Tests

1. Given a fixture calendar with a meeting and a Slack DM during it, outcome is `DELAY_TO_MEETING_END` and `wouldDeliverAt` equals meeting end.
2. A DM from a VIP during a focus block is always `DELIVER`.
3. No record contains message body text (schema test plus a storage scan).
4. Team report returns empty/error when fewer than 5 users have consented.
5. Changing `recoveryMinutes` recomputes the recovery-cost metric without re-ingesting.
6. Deleting a user purges all their records and reports.

---

## 13. Open Questions

1. What are the true minimum Slack scopes for required metadata, and will security teams accept them?
2. Is 45 idle minutes a reasonable `deep_gap` heuristic, or should it be tuned per person?
3. Should `@channel` cost use per-person recovery minutes or a flatter estimate?
4. Do partners prefer the report as a web page, a PDF, or a weekly email?
5. Which price question do we ask: per seat per month, or per recovered hour?

---

## Appendix A: Design-Partner Outreach (Draft)

**Subject:** Two-week experiment: how many of your team's interruptions could have waited?

Hi {{name}},

I'm building a tool that measures how many workplace interruptions (Slack pings, `@channel` mentions, meetings landing on focus time) are actually worth breaking someone's concentration.

I'd like to run it in read-only shadow mode for two weeks. It never sends, blocks, or delays anything. At the end, each person gets a private report: how many interruptions they had, how many could have waited, and a short review where they tell us whether we got it wrong.

- We use metadata only. Message text and calendar titles are not stored.
- Everyone opts in individually. Nobody's manager sees individual results.
- You can pause or delete your data at any time.

In return, I'd ask for 30 minutes of feedback at the end. Would your team be open to trying it?

---

## Appendix B: Feedback Questions After Report

1. Did the report match how your week felt? (1–5)
2. Which single number surprised you most?
3. Would you turn this on live if it delayed only what you approved? (Yes / Maybe / No, and why)
4. What would make you trust it enough to leave it on?
5. Would you or your company pay for this? What would feel like a fair price?
