// Utility for Kerala / Malappuram (Indian Standard Time - UTC+05:30)

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns 'YYYY-MM-DD' for a date in Indian Standard Time (IST)
 */
export function getKeralaDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Returns 'HH:mm:ss' for a date in Indian Standard Time (IST)
 */
export function getKeralaTimeString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return formatter.format(date);
}

/**
 * Formats a time string (e.g. '07:00:00' or '07:00') into 12-hour AM/PM format (e.g. '7:00 AM')
 */
export function formatTimeAMPM(timeStr: string | null | undefined): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1].padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  return `${hours}:${minutes} ${ampm}`;
}

/**
 * Formats 'YYYY-MM-DD' into a human-readable date like 'Sat, 26 Sep 2026'
 */
export function formatDisplayDate(dateStr: string | null | undefined, includeDayName: boolean = true): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-GB', {
    weekday: includeDayName ? 'short' : undefined,
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Checks if current time is within [startTime, endTime]
 * Handles times in 'HH:mm' or 'HH:mm:ss' format
 */
export function isWithinTimeWindow(
  currentTime: string,
  startTime: string,
  endTime: string
): { isOpen: boolean; status: 'upcoming' | 'open' | 'ended' } {
  // Normalize to seconds from start of day
  const toSeconds = (t: string) => {
    const parts = t.split(':').map(Number);
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  };

  const currentSec = toSeconds(currentTime);
  const startSec = toSeconds(startTime);
  const endSec = toSeconds(endTime);

  if (currentSec < startSec) {
    return { isOpen: false, status: 'upcoming' };
  } else if (currentSec <= endSec) {
    return { isOpen: true, status: 'open' };
  } else {
    return { isOpen: false, status: 'ended' };
  }
}

/**
 * Checks if a class unlock is still actively valid
 */
export function isClassUnlockActive(unlockedUntil: string | null | undefined): boolean {
  if (!unlockedUntil) return false;
  return new Date(unlockedUntil).getTime() > Date.now();
}

/**
 * Computes remaining seconds until a given ISO date/time
 */
export function getRemainingSeconds(targetTimeIso: string | null | undefined): number {
  if (!targetTimeIso) return 0;
  const diff = Math.floor((new Date(targetTimeIso).getTime() - Date.now()) / 1000);
  return Math.max(0, diff);
}

/**
 * Formats seconds into MM:SS
 */
export function formatSecondsMMSS(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
