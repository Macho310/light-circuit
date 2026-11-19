import { dateToSeed, canSelectDate } from './daily-date.js';

export function calendarMonth(year, month) {
  const first = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
  // 2000-01-01 was Saturday; avoid local Date parsing and year 0..99 quirks.
  const offset = ((dateToSeed(first) + 6) % 7 + 7) % 7;
  const days = [];
  for (let day = 1; day <= 31; day++) {
    const date = first.slice(0, 8) + String(day).padStart(2, '0');
    try { dateToSeed(date); days.push(date); } catch { break; }
  }
  return { offset, days };
}

export function numericDate(year, month, day, today) {
  if (![year, month, day].every(value => /^\d+$/.test(String(value)))) return null;
  const date = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return canSelectDate(date, today) ? date : null;
}

export function adjacentMonth(year, month, delta) {
  const index = year * 12 + month - 1 + delta;
  return { year: Math.floor(index / 12), month: index % 12 + 1 };
}
