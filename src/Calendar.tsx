import { useState } from 'react';
import { adjacentMonth, calendarMonth, numericDate } from './calendar-model.js';

export default function Calendar({ selected, today, select, close }: { selected: string; today: string; select: (date: string) => boolean; close: () => void }) {
  const [fields, setFields] = useState(selected.split('-'));
  const [view, setView] = useState({ year: Number(fields[0]), month: Number(fields[1]) });
  const { offset, days } = calendarMonth(view.year, view.month);
  const lastMonth = today.slice(0, 7);
  const monthKey = `${String(view.year).padStart(4, '0')}-${String(view.month).padStart(2, '0')}`;
  function commit() {
    const date = numericDate(fields[0], fields[1], fields[2], today);
    if (date && select(date)) { setFields(date.split('-')); setView({ year: Number(fields[0]), month: Number(fields[1]) }); }
  }
  return <div className="calendar-panel">
    <div className="numeric-date" onKeyDown={event => { if (event.key === 'Enter') { commit(); event.preventDefault(); } }}>
      {['西暦', '月', '日'].map((label, i) => <label key={label}>{label}<input type="text" inputMode="numeric" autoComplete="off" aria-label={label} maxLength={i === 0 ? 4 : 2} value={fields[i]} onChange={event => setFields(fields.map((value, j) => i === j ? event.target.value.replace(/\D/g, '') : value))} onBlur={commit} /></label>)}
    </div>
    <div className="calendar-heading">
      <button aria-label="前の月" disabled={monthKey === '0001-01'} onClick={() => setView(adjacentMonth(view.year, view.month, -1))}>‹</button>
      <span>{view.year} / {String(view.month).padStart(2, '0')}</span>
      <button aria-label="次の月" disabled={monthKey >= lastMonth} onClick={() => setView(adjacentMonth(view.year, view.month, 1))}>›</button>
    </div>
    <div className="calendar-grid" role="group" aria-label={`${view.year}年${view.month}月`}>
      {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => <span className="weekday" key={i}>{day}</span>)}
      {Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} />)}
      {days.map(date => <button key={date} disabled={date > today} aria-label={date} aria-pressed={date === selected} aria-current={date === today ? 'date' : undefined} onClick={() => { if (select(date)) close(); }}>{Number(date.slice(-2))}</button>)}
    </div>
  </div>;
}
