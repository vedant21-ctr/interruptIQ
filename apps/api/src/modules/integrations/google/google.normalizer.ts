import { DerivedCalendarBlock } from '@interrupt-iq/shared';

export interface RawGoogleCalendarEventPayload {
  id: string;
  summary?: string;
  description?: string;
  eventType?: 'default' | 'outOfOffice' | 'focusTime';
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email?: string; responseStatus?: string }>;
  transparency?: 'opaque' | 'transparent'; // opaque = busy, transparent = free
  status?: 'confirmed' | 'tentative' | 'cancelled';
}

/**
 * Ephemeral Normalization Boundary for Google Calendar Payloads.
 * Converts raw Google Calendar API event payloads into normalized DerivedCalendarBlock objects.
 * 
 * CRITICAL PRIVACY GUARANTEE:
 * Event titles (summary), descriptions, and attendee email addresses are inspected
 * transiently in memory to derive meeting kind (`ooo`, `meeting`, `focus_block`, `other`),
 * and then raw summaries, descriptions, and attendee lists ARE DISCARDED.
 * Raw event text is NEVER returned or persisted.
 */
export function normalizeGoogleCalendarEvent(
  payload: RawGoogleCalendarEventPayload,
  calendarId: string = 'primary'
): DerivedCalendarBlock | null {
  if (payload.status === 'cancelled') {
    return null; // Skip cancelled meetings
  }

  const startIso = payload.start?.dateTime || (payload.start?.date ? `${payload.start.date}T00:00:00Z` : null);
  const endIso = payload.end?.dateTime || (payload.end?.date ? `${payload.end.date}T23:59:59Z` : null);

  if (!startIso || !endIso) {
    return null; // Skip invalid timing bounds
  }

  const summaryUpper = (payload.summary || '').toUpperCase();
  const attendeeCount = payload.attendees ? payload.attendees.length : 1;

  // 1. Determine Kind Transiently
  let kind: 'ooo' | 'meeting' | 'focus_block' | 'other' = 'other';

  if (payload.eventType === 'outOfOffice' || summaryUpper.includes('OOO') || summaryUpper.includes('VACATION')) {
    kind = 'ooo';
  } else if (payload.eventType === 'focusTime' || summaryUpper.includes('FOCUS')) {
    kind = 'focus_block';
  } else if (attendeeCount >= 2) {
    kind = 'meeting';
  }

  // 2. Determine Busy Status (opaque = busy, transparent = free)
  const isBusy = payload.transparency !== 'transparent';

  // 3. Stable Provider Event Identifier for Idempotent Deduplication
  const providerEventId = `google:${calendarId}:${payload.id}`;

  return {
    id: providerEventId,
    start: new Date(startIso).toISOString(),
    end: new Date(endIso).toISOString(),
    kind,
    isBusy,
    attendeeCount,
  };
}
