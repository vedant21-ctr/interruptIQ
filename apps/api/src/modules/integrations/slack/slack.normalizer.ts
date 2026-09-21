import { InterruptionRecord } from '@interrupt-iq/shared';

export interface RawSlackMessagePayload {
  ts: string;
  user: string;
  text?: string;
  channel?: string;
  channel_type?: 'im' | 'mpim' | 'private' | 'public';
  thread_ts?: string;
  team?: string;
}

const URGENCY_KEYWORDS = ['URGENT', 'ASAP', 'BLOCKER', 'CRITICAL', 'EMERGENCY', 'SEV-1', 'SEV1', 'P0'];

/**
 * Ephemeral Normalization Boundary for Slack Payloads.
 * Converts raw Slack API/Event payloads into normalized InterruptionRecord objects.
 * 
 * CRITICAL PRIVACY GUARANTEE:
 * Message text payload is inspected transiently in memory to compute features
 * (`hasUrgencySignal`, `mentionType`), and then raw message text IS DISCARDED.
 * Raw message text is NEVER returned or persisted.
 */
export function normalizeSlackMessage(
  payload: RawSlackMessagePayload,
  userId: string,
  connectedSlackUserId?: string,
  vipUserIds: string[] = []
): InterruptionRecord {
  const text = (payload.text || '').toUpperCase();

  // 1. Detect Urgency Signals in Memory
  const hasUrgencySignal = URGENCY_KEYWORDS.some((kw) => text.includes(kw));

  // 2. Determine Mention Type
  let mentionType: 'direct' | 'channel' | 'here' | 'thread_reply' | 'none' = 'none';

  if (text.includes('<!CHANNEL>') || text.includes('@CHANNEL')) {
    mentionType = 'channel';
  } else if (text.includes('<!HERE>') || text.includes('@HERE')) {
    mentionType = 'here';
  } else if (connectedSlackUserId && text.includes(`<@${connectedSlackUserId.toUpperCase()}>`)) {
    mentionType = 'direct';
  } else if (payload.thread_ts && payload.thread_ts !== payload.ts) {
    mentionType = 'thread_reply';
  } else if (payload.channel_type === 'im') {
    mentionType = 'direct';
  }

  // 3. Determine Channel Type
  const channelType: 'dm' | 'group_dm' | 'private' | 'public' =
    payload.channel_type === 'im'
      ? 'dm'
      : payload.channel_type === 'mpim'
      ? 'group_dm'
      : payload.channel_type === 'private'
      ? 'private'
      : 'public';

  // 4. Determine Sender Tier
  const isVip = vipUserIds.includes(payload.user);
  const senderTier: 'vip' | 'frequent' | 'other' = isVip ? 'vip' : 'other';

  // 5. Compute Slack Permalink
  const cleanedTs = payload.ts.replace('.', '');
  const slackPermalink = `https://slack.com/archives/${payload.channel || 'C00000000'}/p${cleanedTs}`;

  // 6. Convert Timestamp to UTC ISO 8601
  const timestampMs = parseFloat(payload.ts) * 1000;
  const receivedAt = new Date(timestampMs).toISOString();

  // 7. Stable Provider Event Identifier for Idempotent Deduplication
  const providerEventId = `slack:${payload.team || 'workspace'}:${payload.channel || 'channel'}:${payload.ts}`;

  return {
    id: providerEventId,
    userId,
    receivedAt,
    source: 'slack',
    channelType,
    mentionType,
    senderId: payload.user || 'unknown_sender',
    senderTier,
    hasUrgencySignal,
    slackPermalink,
    isIncidentChannel: payload.channel?.includes('incident') || payload.channel?.includes('oncall'),
  };
}
