# Slack Platform API Feasibility Analysis (Focus Report v0)

> **Document Status:** Technical Integration & Scope Audit  
> **Target System:** Slack Web API / Events API  
> **Objective:** Define exact minimum OAuth scopes, permission requirements, and data privacy boundaries for read-only shadow mode.

---

## 1. Executive Summary

InterruptIQ Focus Report v0 operates in **read-only shadow mode**. It observes incoming notification candidates (DMs, group DMs, `@mentions`, `@channel`/`@here`, and thread replies) to compute counterfactual delivery decisions without blocking, delaying, or modifying live messages.

### Critical Privacy Principle
> **"InterruptIQ does not store message bodies."**
> 
> *Technical distinction:* Slack's API sends message text payload over TLS to our ingestion boundary. At the ingestion layer, InterruptIQ extracts metadata features (e.g. `mentionType`, `hasUrgencyKeyword`, `senderTier`), and **immediately discards the raw message body string** before persistence, logging, caching, or queueing.

---

## 2. Minimum Required OAuth Scopes

Slack provides User Scopes (`user:read`, `channels:read`, etc.) and Bot Scopes (`app_mentions:read`, `channels:history`, etc.). For Focus Report v0, a **User Token (`xoxp-`)** or a **Bot Token (`xoxb-`)** with granular scopes is required.

### Required OAuth Scopes Table

| Scope | Type | Purpose | Raw Data Received | Persisted Fields |
| :--- | :--- | :--- | :--- | :--- |
| `users:read` | Bot / User | Identify connected user ID, team ID, timezone | User profile, name, email | `userId`, `slackUserId`, `timezone` |
| `channels:read` | Bot / User | List public channels user participates in | Channel IDs and names | `channelId`, `channelType: "public"` |
| `groups:read` | User | Read metadata for private channels user belongs to | Private channel IDs | `channelId`, `channelType: "private"` |
| `im:read` | User | Detect direct message (DM) events | DM channel metadata | `channelType: "dm"` |
| `mpim:read` | User | Detect group DM (MPIM) events | Group DM channel metadata | `channelType: "group_dm"` |
| `channels:history` | User / Bot | Retrieve conversation history for replay/audit | Timestamp, user ID, message text | Metadata features ONLY (see Sec 4) |
| `groups:history` | User | Retrieve private channel conversation history | Timestamp, user ID, message text | Metadata features ONLY |
| `im:history` | User | Retrieve DM conversation history for replay | Timestamp, user ID, message text | Metadata features ONLY |
| `mpim:history` | User | Retrieve group DM history for replay | Timestamp, user ID, message text | Metadata features ONLY |

---

## 3. Events API vs. Web API History Retrieval

### 3.1 Events API (`message` & `app_mention` events)
- **Mechanism:** Real-time HTTP POST webhooks delivered to InterruptIQ API when Slack events occur.
- **Coverage:**
  - `message.im`: DM received by connected user.
  - `message.mpim`: Group DM message received.
  - `message.groups`: Message in private channel user is in.
  - `message.channels`: Message in public channel user is in.
  - `app_mention`: Direct `@InterruptIQ` mentions.
- **Limitation:** Events API requires active socket/webhook connection and does not provide historical backlog if the service is offline.

### 3.2 Web API (`conversations.history` & `conversations.replies`)
- **Mechanism:** Polled HTTP GET requests.
- **Coverage:** Enables historical 2-week baseline analysis upon initial connection, catching up on missed windows.
- **Rate Limits:** Tier 3 (`50 requests / minute`) or Tier 4 (`100+ requests / minute`).

---

## 4. Ingestion Data Boundary & Feature Extraction

### Feature Derivation at Ingestion Boundary

```
Incoming Slack Webhook Payload (JSON)
                │
                ▼
┌──────────────────────────────────────────┐
│ Transient Ingestion Parser (Memory-Only) │
│ - Extract timestamp, channel, sender     │
│ - Scan text for urgency keywords         │
│ - Compute mentionType (direct, channel)  │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│  Raw Message Text DISCARDED / Erased     │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│  Normalized InterruptionRecord (Persisted)│
│  - senderTier: "vip" | "frequent"        │
│  - channelType: "dm" | "public"          │
│  - mentionType: "direct" | "channel"     │
│  - hasUrgencySignal: boolean             │
│  - slackPermalink: string (Deep link)    │
└──────────────────────────────────────────┘
```

---

## 5. Security & Admin Approval Considerations

1. **Slack App Directory / Enterprise Grid Approval:**
   - Security teams evaluate Slack apps based on requested scopes.
   - Using `*:history` user scopes may require workspace admin approval in Enterprise Grid organizations.
   - *Mitigation strategy:* Provide a clear, open-source audit guarantee demonstrating zero message body persistence.

2. **Permalink Generation:**
   - Instead of storing message text for the 20-sample review queue, InterruptIQ constructs a **Slack Permalink** (`https://workspace.slack.com/archives/C123/p1690000`).
   - When the user clicks the review queue item, Slack opens the message directly inside the official Slack UI.

---

## 6. Open Feasibility Questions

1. **User Token (`xoxp-`) Scope Sensitivity:** Will enterprise workspace admins approve user-level `im:history` scopes for design partners?  
   *Fallback Plan:* If user DM scopes are restricted by workspace policy, Focus Report v0 operates exclusively on public channel `@channel` / `@here` mentions and direct `@mentions`.
