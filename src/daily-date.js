export const FIRST_DATE = '0001-01-01';
const DAY_MS = 86400000;
const EPOCH = Date.UTC(2000, 0, 1);
const tokyo = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
  timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function todayInTokyo(now = new Date()) {
  const parts = Object.fromEntries(tokyo.formatToParts(now).map(p => [p.type, p.value]));
  return `${parts.year.padStart(4, '0')}-${parts.month}-${parts.day}`;
}

export function dateToSeed(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RangeError('Invalid calendar date');
  const [year, month, day] = date.split('-').map(Number);
  const utc = new Date(0);
  utc.setUTCFullYear(year, month - 1, day);
  if (year < 1 || utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) throw new RangeError('Invalid calendar date');
  return (utc.getTime() - EPOCH) / DAY_MS;
}

export function canSelectDate(date, today = todayInTokyo()) {
  try { dateToSeed(date); dateToSeed(today); return date <= today; } catch { return false; }
}

// Append future effective dates only. Never rewrite a historical range.
export const DAILY_VERSIONS = Object.freeze([
  Object.freeze({ from: FIRST_DATE, version: 'unique-spread-1' }),
]);
export function dailyIdentity(date) {
  const seed = dateToSeed(date);
  const entry = [...DAILY_VERSIONS].reverse().find(entry => entry.from <= date);
  if (!entry) throw new RangeError('No generator for this date');
  return { date, seed, generatorVersion: entry.version };
}
