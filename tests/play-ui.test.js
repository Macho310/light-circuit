import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { componentURL } from './react-markup.js';
import { calendarMonth, numericDate, adjacentMonth } from '../src/calendar-model.js';
import { createPlayClock, formatElapsed, shareResult } from '../src/play-clock.js';

test('timer starts at display, excludes pauses, and stops permanently on solve', () => {
  let now = 0;
  const clock = createPlayClock(() => now);
  now = 5000; assert.equal(clock.snapshot().elapsed, 0);
  clock.start(); now = 6200; assert.equal(clock.snapshot().elapsed, 1200);
  clock.start(); now = 7000; assert.equal(clock.snapshot().elapsed, 2000);
  clock.pause(); now = 17000; assert.equal(clock.snapshot().elapsed, 2000);
  clock.pause(); clock.resume(); now = 18500; assert.equal(clock.snapshot().elapsed, 3500);
  clock.solve(); now = 90000; clock.resume(); clock.pause(); clock.solve();
  assert.deepEqual(clock.snapshot(), { elapsed: 3500, paused: false, solved: true });
  assert.equal(formatElapsed(0), '00:00'); assert.equal(formatElapsed(59999), '00:59');
  assert.equal(formatElapsed(60000), '01:00'); assert.equal(formatElapsed(3600000), '60:00');
  assert.equal(shareResult('2026-11-19', 222000, 'https://example.com/light-circuit/'), '💡 Light Circuit 2026/11/19\n⚡ 03:42でクリア！\n\n#LightCircuit\nhttps://example.com/light-circuit/');
});

test('custom Gregorian calendar uses correct weekdays, leap days and numeric validation', () => {
  assert.equal(calendarMonth(2000, 1).offset, 6);
  assert.equal(calendarMonth(2026, 11).offset, 0);
  assert.equal(calendarMonth(2024, 2).days.length, 29);
  assert.equal(calendarMonth(1900, 2).days.length, 28);
  assert.deepEqual(adjacentMonth(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(adjacentMonth(2026, 1, -1), { year: 2025, month: 12 });
  assert.equal(numericDate('2024', '2', '29', '2026-11-19'), '2024-02-29');
  assert.equal(numericDate('2026', '11', '20', '2026-11-19'), null);
  assert.equal(numericDate('2026', '2', '29', '2026-11-19'), null);
  assert.equal(numericDate('', '1', '1', '2026-11-19'), null);
});

test('calendar shows numeric fields and all days together, disables future days, has no close button or era', async () => {
  const { default: Calendar } = await import(componentURL(new URL('../src/Calendar.tsx', import.meta.url)));
  const html = renderToStaticMarkup(createElement(Calendar, { selected: '2026-11-19', today: '2026-11-19', select: () => true, close: () => {} }));
  assert.equal((html.match(/inputMode="numeric"/g) ?? []).length, 3);
  assert.equal((html.match(/aria-label="2026-11-/g) ?? []).length, 30);
  assert.match(html, /disabled="" aria-label="2026-11-20"/);
  assert.match(html, /aria-label="2026-11-19" aria-pressed="true"/);
  assert(!html.includes('type="date"')); assert(!html.includes('閉じる'));
  assert(!html.includes('令和')); assert(!html.includes('平成'));
});

test('running, paused and solved presentations have correct timer, controls and tray visibility', async () => {
  const { GameDisplay } = await import(componentURL(new URL('../src/App.tsx', import.meta.url)));
  const props = { date: '2026-11-19', timing: { elapsed: 65000, paused: false, solved: false }, home() {}, pause() {}, copy() {}, copyMessage: '' };
  const running = renderToStaticMarkup(createElement(GameDisplay, props));
  assert(running.includes('01:05')); assert(running.includes('2026-11-19'));
  assert(!running.includes('id="status"')); assert(!running.includes('game-status'));
  assert(running.includes('aria-label="一時停止"')); assert(running.includes('class="title-home"'));
  assert(!running.includes('答えを表示')); assert(!running.includes('>home</button>'));
  assert.equal((running.match(/<rect\b/g) ?? []).length, 2);
  const paused = renderToStaticMarkup(createElement(GameDisplay, { ...props, timing: { ...props.timing, paused: true } }));
  assert(paused.includes('is-paused')); assert(paused.includes('id="workspace" inert="" aria-hidden="true"'));
  assert(paused.includes('class="pause-cover">Pause</div>')); assert(paused.includes('aria-label="再開"'));
  const solved = renderToStaticMarkup(createElement(GameDisplay, { ...props, timing: { ...props.timing, solved: true } }));
  assert(solved.includes('class="time-card solved"')); assert.match(solved, /class="solved-label"[^>]*visibility:visible[^>]*>solved<\/div>/);
  assert.match(solved, /id="tray"[^>]*hidden=""/); assert(solved.includes('id="workspace" inert=""'));
  assert(solved.includes('aria-label="結果を共有"')); assert(solved.includes('aria-label="ホームに戻る"'));
  assert(solved.includes('aria-haspopup="dialog"'));
  assert(solved.includes('class="share-dialog"'));
  assert(!solved.includes('<dialog open'));
  assert(solved.includes('aria-label="共有する文章"'));
  assert(solved.includes('>コピー</button>'));
  assert(!running.includes('class="share-dialog"'));
  assert(!solved.includes('aria-label="一時停止"'));
});
