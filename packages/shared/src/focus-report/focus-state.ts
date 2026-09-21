import { DerivedCalendarBlock, FocusState, UserSettings } from './types';

/**
 * Pure function to infer the user's focus state at a specific timestamp.
 * 
 * Priority Matching Rules (First match wins):
 * 1. ooo: Calendar block marked "ooo" OR timestamp outside working hours.
 * 2. meeting: Calendar block marked "meeting" (2+ attendees) active at timestamp.
 * 3. focus_block: Calendar block marked "focus_block" active at timestamp.
 * 4. quiet_window: 45+ minutes with no meeting and no outgoing activity.
 * 5. available: Default state.
 */
export function inferFocusState(
  calendarBlocks: DerivedCalendarBlock[],
  lastActivityAt: string | null,
  timestampIso: string,
  config: UserSettings
): FocusState {
  const targetTime = new Date(timestampIso).getTime();

  // 1. Check Out of Office (OOO) or outside working hours
  const isOutsideHours = checkOutsideWorkingHours(timestampIso, config.workingHours);
  const activeOoo = calendarBlocks.find(
    (b) => b.kind === 'ooo' && isWithinBlock(targetTime, b)
  );
  if (isOutsideHours || activeOoo) {
    return 'ooo';
  }

  // 2. Check Active Meeting
  const activeMeeting = calendarBlocks.find(
    (b) => b.kind === 'meeting' && isWithinBlock(targetTime, b)
  );
  if (activeMeeting) {
    return 'meeting';
  }

  // 3. Check Active Focus Block
  const activeFocusBlock = calendarBlocks.find(
    (b) => b.kind === 'focus_block' && isWithinBlock(targetTime, b)
  );
  if (activeFocusBlock) {
    return 'focus_block';
  }

  // 4. Check Quiet Window (quiet_window proxy: 45+ minutes with no meeting and no activity)
  if (lastActivityAt) {
    const lastActivityTime = new Date(lastActivityAt).getTime();
    const elapsedMinutes = (targetTime - lastActivityTime) / (1000 * 60);

    if (elapsedMinutes >= config.quietWindowThresholdMinutes) {
      // Ensure no meeting overlapped in the preceding window
      const hasRecentMeeting = calendarBlocks.some(
        (b) => b.kind === 'meeting' && b.end > lastActivityAt && b.start < timestampIso
      );
      if (!hasRecentMeeting) {
        return 'quiet_window';
      }
    }
  }

  // 5. Default: Available
  return 'available';
}

function isWithinBlock(targetMs: number, block: DerivedCalendarBlock): boolean {
  const startMs = new Date(block.start).getTime();
  const endMs = new Date(block.end).getTime();
  return targetMs >= startMs && targetMs < endMs;
}

function checkOutsideWorkingHours(
  timestampIso: string,
  workingHours: { start: string; end: string; tz: string }
): boolean {
  const date = new Date(timestampIso);
  const hours = date.getUTCHours(); // Basic UTC check fallback
  const minutes = date.getUTCMinutes();
  const currentMinutes = hours * 60 + minutes;

  const [startH, startM] = workingHours.start.split(':').map(Number);
  const [endH, endM] = workingHours.end.split(':').map(Number);

  const startTotal = startH * 60 + startM;
  const endTotal = endH * 60 + endM;

  if (startTotal <= endTotal) {
    return currentMinutes < startTotal || currentMinutes >= endTotal;
  } else {
    // Overnight working hours range
    return currentMinutes < startTotal && currentMinutes >= endTotal;
  }
}
