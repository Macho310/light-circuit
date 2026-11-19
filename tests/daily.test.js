import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { componentURL } from './react-markup.js';
import { todayInTokyo, dateToSeed, canSelectDate, dailyIdentity } from '../src/daily-date.js';
import { generateDailyPuzzle } from '../src/daily-generator.js';
import { createDailySession } from '../src/daily-session.js';

test('calendar dates are strict, injective and independent of local timezone', () => {
  assert.equal(dateToSeed('2000-01-01'), 0);
  assert.equal(dateToSeed('1999-12-31'), -1);
  for (const [a, b] of [['2026-01-31', '2026-02-01'], ['2026-12-31', '2027-01-01'], ['2024-02-28', '2024-02-29'], ['2024-02-29', '2024-03-01'], ['1900-02-28', '1900-03-01'], ['2000-02-28', '2000-02-29'], ['0099-12-31', '0100-01-01']]) {
    assert.equal(dateToSeed(b) - dateToSeed(a), 1);
  }
  for (const date of ['2026-02-29', '1900-02-29', '2024-02-30', '2026-13-01', '2026-00-01', '2026-01-00', '2026-1-1', '0000-01-01', '2026-01-01T00:00:00Z']) assert.throws(() => dateToSeed(date));
  const seeds = new Set();
  for (let time = Date.UTC(2020, 0, 1); time <= Date.UTC(2030, 11, 31); time += 86400000) seeds.add(dateToSeed(new Date(time).toISOString().slice(0, 10)));
  assert.equal(seeds.size, (Date.UTC(2031, 0, 1) - Date.UTC(2020, 0, 1)) / 86400000);
  assert(canSelectDate('2024-02-29', '2026-11-19'));
  assert(canSelectDate('2026-11-19', '2026-11-19'));
  assert(!canSelectDate('2026-11-20', '2026-11-19'));
});

test('Tokyo midnight, year end and leap day agree across host timezones', () => {
  const instants = ['2026-11-18T14:59:59.999Z', '2026-11-18T15:00:00.000Z', '2026-12-31T15:00:00.000Z', '2024-02-28T15:00:00.000Z', '2024-02-29T15:00:00.000Z'];
  const expected = ['2026-11-18', '2026-11-19', '2027-01-01', '2024-02-29', '2024-03-01'];
  assert.deepEqual(instants.map(time => todayInTokyo(new Date(time))), expected);
  const url = new URL('../src/daily-date.js', import.meta.url).href;
  const script = `import {todayInTokyo,dateToSeed} from ${JSON.stringify(url)}; console.log(JSON.stringify(${JSON.stringify(instants)}.map(t=>[todayInTokyo(new Date(t)),dateToSeed(todayInTokyo(new Date(t)))])))`;
  const outputs = ['UTC', 'Asia/Tokyo', 'America/Los_Angeles', 'Pacific/Kiritimati'].map(TZ => execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', env: { ...process.env, TZ } }));
  assert(outputs.every(output => output === outputs[0]));
});

test('archived implementation and daily outputs match immutable golden fingerprints', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/daily-v1.json', import.meta.url)));
  const hash = value => createHash('sha256').update(value).digest('hex');
  for (const [file, expected] of Object.entries(fixture.sources)) {
    assert.equal(hash(readFileSync(new URL(`../src/versions/unique-spread-1/${file}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')), expected);
  }
  for (const { date, fingerprint } of fixture.days) {
    const a = generateDailyPuzzle(date), b = generateDailyPuzzle(date);
    assert(a.puzzle); assert.deepEqual(a.puzzle, b.puzzle);
    assert.deepEqual(a.puzzle.daily, dailyIdentity(date));
    assert.equal(hash(JSON.stringify(a.puzzle)), fingerprint);
    assert(a.puzzle.validation.complete); assert.equal(a.puzzle.validation.solutions, 1);
  }
});

test('date selection does not generate; double play, midnight, home, cancellation and failures', () => {
  let time = new Date('2026-11-18T14:59:59Z');
  const workers = [];
  const session = createDailySession({ now: () => time, createWorker: () => {
    const w = { terminate() { this.terminated = true; }, postMessage(data) { this.request = data; } }; workers.push(w); return w;
  } });
  const reply = (w, data) => w.onmessage({ data: { requestId: w.request.requestId, ...data } });
  assert.equal(session.getState().selectedDate, '2026-11-18');
  assert(session.selectDate('2024-02-29')); assert.equal(workers.length, 0);
  assert(!session.selectDate('2026-11-19')); assert.equal(session.getState().selectedDate, '2024-02-29');
  session.rules(); assert.equal(session.getState().screen, 'rules'); assert(!session.play());
  session.home(); assert.equal(session.getState().selectedDate, '2024-02-29');
  assert(session.play()); assert(!session.play()); assert.equal(workers.length, 1);
  assert.equal(workers[0].request.date, '2024-02-29');
  time = new Date('2026-11-18T15:00:00Z'); session.refreshToday();
  assert.equal(session.getState().today, '2026-11-19'); assert.equal(session.getState().selectedDate, '2024-02-29');
  const identity = dailyIdentity('2024-02-29');
  const puzzle = { seed: identity.seed, generatorVersion: identity.generatorVersion, daily: identity, validation: { complete: true, solutions: 1 } };
  reply(workers[0], { type: 'result', puzzle }); assert.equal(session.getState().screen, 'game');
  session.home(); assert(session.play()); session.home(); assert(workers[1].terminated);
  reply(workers[1], { type: 'result', puzzle }); assert.equal(session.getState().screen, 'home');
  session.play(); reply(workers[2], { type: 'result', puzzle: null }); assert.equal(session.getState().screen, 'error');
  session.home(); session.play(); assert.equal(workers[3].request.date, '2024-02-29');
  reply(workers[3], { type: 'result', puzzle: { ...puzzle, seed: identity.seed + 1 } }); assert.equal(session.getState().screen, 'error');
  session.home(); session.play(); session.dispose(); assert(workers[4].terminated);
  reply(workers[4], { type: 'result', puzzle }); assert.notEqual(session.getState().screen, 'game');
});

test('home markup contains only requested visible elements and one simple circuit icon', async () => {
  const sourceURL = new URL('../src/App.tsx', import.meta.url);
  const { Home } = await import(componentURL(sourceURL));
  const session = createDailySession({ now: () => new Date('2026-11-18T15:00:00Z') });
  const html = renderToStaticMarkup(createElement(Home, { session }));
  const visible = html.replace(/<dialog\b[\s\S]*?<\/dialog>/, '');
  assert.equal((visible.match(/<button\b/g) ?? []).length, 3);
  assert.equal((visible.match(/role="img"/g) ?? []).length, 1);
  assert.equal((visible.match(/<h1>/g) ?? []).length, 1);
  assert.equal((visible.match(/<time\b/g) ?? []).length, 1);
  assert.match(visible, />PLAY<\/button>/); assert.match(visible, />HOW TO PLAY<\/button>/);
  assert(!/<p\b|<input\b|<aside\b/.test(visible));
  assert(!html.includes('stroke-dasharray'));
  assert.equal((visible.match(/<circle\b/g) ?? []).length, 1);
  assert(!html.includes('閉じる'));
  assert(!/<dialog[^>]*\bopen/.test(html)); session.dispose();
});

test('daily worker uses the pinned version for the selected date', async () => {
  const worker = new Worker(new URL('./worker-harness.js', import.meta.url));
  try {
    const result = await new Promise((resolve, reject) => {
      worker.on('error', reject);
      worker.on('message', data => { if (data.type === 'result') resolve(data); if (data.type === 'error') reject(new Error(data.message)); });
      worker.postMessage({ date: '2026-11-19', requestId: 91 });
    });
    assert.equal(result.requestId, 91);
    assert.deepEqual(result.puzzle, generateDailyPuzzle('2026-11-19').puzzle);
  } finally { await worker.terminate(); }
});
