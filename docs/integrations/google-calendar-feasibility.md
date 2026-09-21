# Google Calendar API Feasibility Analysis (Focus Report v0)

> **Document Status:** Technical Integration & Scope Audit  
> **Target System:** Google Calendar REST API v3  
> **Objective:** Define exact minimum OAuth scopes, permission requirements, and data privacy boundaries for read-only focus state inference.

---

## 1. Executive Summary

InterruptIQ Focus Report v0 uses Google Calendar to infer user **Focus States** (`ooo`, `meeting`, `focus_block`, `quiet_window`, `available`).

### Critical Privacy Principle
> **"InterruptIQ does not store meeting titles, descriptions, or attendee email addresses."**
> 
> *Technical distinction:* Google Calendar events contain event titles (e.g. "Q3 Board Meeting"), descriptions, and attendee lists. InterruptIQ extracts only meeting timing, attendee count, busy/free status, and event type classification (`meeting`, `focus_block`, `ooo`), discarding all raw textual titles and personal attendee identities.

---

## 2. OAuth Scope Options & Comparison

Google Calendar API provides multiple OAuth scopes with varying levels of privacy and user trust requirements.

### Scope Comparison Table

| OAuth Scope | Access Level | Fields Available | Privacy Risk | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| `https://www.googleapis.com/auth/calendar.events.readonly` | Read-only event details | Start, end, summary, description, attendees, status, transparency | Moderate | **PRIMARY FOR V0** |
| `https://www.googleapis.com/auth/calendar.readonly` | Read-only calendar metadata + events | Calendar settings, event details | Moderate-High | Secondary fallback |
| `https://www.googleapis.com/auth/calendar.freebusy` | Free/Busy status only | Start time, end time, busy/free status | Extremely Low | Narrow alternative |

---

## 3. Why `calendar.freebusy` vs. `calendar.events.readonly`?

### 3.1 The `calendar.freebusy` Tradeoff
- **Advantage:** Maximum user privacy trust. The API returns only time blocks marked `busy` or `free`.
- **Disadvantage:** Cannot distinguish between a 1-on-1 meeting, a 15-person department call, an Out-Of-Office (OOO) block, or a Focus Block event created by Google Calendar's native "Focus time" feature.

### 3.2 The Chosen Strategy for v0: `calendar.events.readonly` with Transient Classification
To accurately infer `focus_block` vs `meeting` vs `ooo`, InterruptIQ uses `calendar.events.readonly`, processes events transiently, and derives normalized kinds:

```
Raw Calendar Event (Memory-Only)
   │
   ├── eventType == "outOfOffice" ──────► Kind: "ooo"
   ├── eventType == "focusTime" ────────► Kind: "focus_block"
   ├── attendees.length >= 2 ───────────► Kind: "meeting"
   └── summary contains "Focus" ────────► Kind: "focus_block"
   │
   ▼
Derived CalendarBlock (Persisted)
   - start: ISO 8601
   - end: ISO 8601
   - kind: "ooo" | "meeting" | "focus_block" | "other"
   - isBusy: boolean
   - (Raw Summary & Attendees DISCARDED)
```

---

## 4. Google OAuth Verification & Compliance

1. **Restricted Scopes & Security Assessment:**
   - Both `calendar.readonly` and `calendar.events.readonly` are classified as **Restricted Scopes** under Google's API Services User Data Policy.
   - Production deployment for external users requires a Google OAuth Verification review and CASA Tier 2 security assessment.
2. **Internal & Design Partner Exemption:**
   - During shadow mode validation with unverified app status, up to **100 specific design partner test users** can connect via OAuth consent screen test user approval without undergoing formal CASA audit.

---

## 5. Synchronization Strategy

1. **Initial Hydration:** Sync past 14 days of calendar events using `events.list` with `timeMin` set to 14 days prior.
2. **Incremental Sync:** Store `nextSyncToken` and execute push notifications via Google Calendar Webhooks (`events.watch`) or background sync queue.
