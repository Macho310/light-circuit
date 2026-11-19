import test from 'node:test';
import assert from 'node:assert/strict';
import { mountGame } from '../src/game.js';
import { generatePuzzle } from '../src/generator.js';
import { cells } from '../src/circuit.js';

// Exercise real event handlers/rendering with a minimal DOM and Worker transport.
// This checks SVG output and state transitions, not browser visual layout.
function harness(options = { seed: 'ui-test' }) {
  class Element {
    children = []; dataset = {}; style = {}; attributes = {}; innerHTML = ''; textContent = ''; captures = new Set();
    append(child) { this.children.push(child); }
    setAttribute(key, value) { this.attributes[key] = value; }
    createSVGPoint() { return { x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y }; } }; }
    getScreenCTM() { return { inverse() { return {}; } }; }
    getBoundingClientRect() { return { left: 0, top: 0, right: 600, bottom: 600 }; }
    setPointerCapture(id) { this.captures.add(id); }
    hasPointerCapture(id) { return this.captures.has(id); }
    releasePointerCapture(id) { this.captures.delete(id); }
  }
  const elements = Object.fromEntries(['board', 'tray', 'workspace', 'status', 'number', 'new', 'answer', 'ghost'].map(id => [id, new Element()]));
  const workers = [];
  class MockWorker {
    constructor(url, options) { this.url = url; this.options = options; workers.push(this); }
    postMessage(data) { this.request = data; }
    terminate() { this.terminated = true; }
    deliver(data) { this.onmessage({ data: { ...data, requestId: this.request.requestId } }); }
  }
  const oldDocument = globalThis.document, oldWorker = globalThis.Worker;
  globalThis.document = { getElementById: id => elements[id], createElement: () => new Element() };
  globalThis.Worker = MockWorker;
  const cleanup = mountGame(options);
  const event = (id, x, y) => ({ target: { closest: () => ({ dataset: { piece: String(id) } }) }, pointerId: 1, button: 0, clientX: x, clientY: y, preventDefault() {} });
  return { elements, workers, event, cancelDrag: cleanup.cancelDrag, cleanup() { cleanup(); globalThis.document = oldDocument; globalThis.Worker = oldWorker; } };
}

test('daily game mounts the supplied puzzle without starting another worker or changing its date', () => {
  const p = generatePuzzle('ui-test').puzzle;
  p.daily = { date: '2024-02-29' };
  const h = harness({ puzzle: p });
  try {
    assert.equal(h.workers.length, 0);
    assert.equal(h.elements.number.textContent, '2024-02-29');
    h.elements.answer.onclick();
    assert.equal(h.elements.status.className, 'win');
    assert.equal(h.elements.number.textContent, '2024-02-29');
    assert.equal(h.elements.board.dataset.seed, 'ui-test');
  } finally { h.cleanup(); }
});

test('game remains playable and reports completion without a status panel', () => {
  let solved = false;
  const h = harness({ puzzle: generatePuzzle('ui-test').puzzle, onSolved: () => { solved = true; } });
  try {
    delete h.elements.status;
    h.elements.answer.onclick();
    assert(solved);
    assert(h.elements.board.innerHTML.includes('lamp-symbol'));
  } finally { h.cleanup(); }
});

test('worker progress, cancellation, failures, stale results and unmount', () => {
  const h = harness(), { elements: el, workers } = h;
  try {
    assert.equal(el.tray.children.length, 4); assert(el.answer.disabled);
    assert.equal(workers[0].options.type, 'module'); assert.match(workers[0].url.href, /generator\.worker\.js$/);
    workers[0].deliver({ type: 'progress', stats: { candidates: 3 } }); assert.match(el.status.textContent, /3/);
    el.new.onclick(); assert(workers[0].terminated); assert.equal(workers[1].request.seed, 'ui-test:1');
    workers[0].deliver({ type: 'result', puzzle: {} }); assert.equal(el.board.innerHTML, '');
    workers[1].deliver({ type: 'result', puzzle: null }); assert(el.answer.disabled); assert.match(el.status.textContent, /試行上限/);
    el.new.onclick(); workers[2].onerror({ preventDefault() {} }); assert.match(el.status.textContent, /失敗/);
    el.new.onclick(); h.cleanup(); assert(workers[3].terminated);
    workers[3].deliver({ type: 'result', puzzle: {} }); assert.equal(el.board.innerHTML, '');
  } finally { if (globalThis.document) h.cleanup(); }
});

test('rotation, drag/drop, overlap and one-shot completion with all subsequent interaction locked', () => {
  const p = generatePuzzle('ui-test').puzzle;
  let completions = 0;
  const h = harness({ puzzle: p, onSolved: () => completions++ }), { elements: el, event } = h;
  const turns = [0, 0, 0, 0];
  function place(id) {
    const pos = p.answer[id];
    while (turns[id] !== pos.d) {
      el.workspace.onpointerdown(event(id, 700, 700)); el.workspace.onpointerup(event(id, 700, 700));
      turns[id] = (turns[id] + 1) % 4;
    }
    const points = cells(p, { x: 0, y: 0, d: pos.d }, id);
    const ox = (Math.min(...points.map(c => c[0])) + Math.max(...points.map(c => c[0]))) * 70;
    const oy = (Math.min(...points.map(c => c[1])) + Math.max(...points.map(c => c[1]))) * 70;
    const x = 90 + pos.x * 140 + ox, y = 90 + pos.y * 140 + oy;
    el.workspace.onpointerdown(event(id, 700, 700)); el.workspace.onpointermove(event(id, x, y));
    el.workspace.onpointerup(event(id, x, y));
  }
  try {
    assert(!el.tray.children.some(slot => slot.innerHTML.includes('actual-current')));
    for (let d = 0; d < 4; d++) {
      const before = el.tray.children[0].innerHTML;
      el.workspace.onpointerdown(event(0, 700, 700)); el.workspace.onpointerup(event(0, 700, 700));
      assert.notEqual(before, el.tray.children[0].innerHTML);
    }
    [0, 1, 2].forEach(place); assert.equal(completions, 0);
    const pos = p.answer[0], x = 90 + pos.x * 140, y = 90 + pos.y * 140;
    el.workspace.onpointerdown(event(0, x, y)); el.workspace.onpointermove(event(0, 700, 700));
    assert(!el.ghost.hidden); assert(el.ghost.innerHTML.includes('drag-highlight'));
    el.workspace.onpointerup(event(0, 700, 700)); place(0);
    let overlap;
    for (let id = 0; id < 3 && !overlap; id++) {
      const cs = cells(p, p.answer[id], id);
      for (const [a, b] of p.links[id]) for (const [u, v] of [...p.wires, ...p.fixed.map(c => [c.a, c.b])]) for (const [start, end] of [[u, v], [v, u]]) {
        if (end % 4 - start % 4 !== cs[b][0] - cs[a][0] || Math.floor(end / 4) - Math.floor(start / 4) !== cs[b][1] - cs[a][1]) continue;
        const tx = start % 4 - cs[a][0], ty = Math.floor(start / 4) - cs[a][1];
        if (cs.every(([x, y]) => x + tx >= 0 && x + tx < 4 && y + ty >= 0 && y + ty < 4)) overlap = { id, tx, ty };
      }
    }
    assert(overlap);
    const { id, tx, ty } = overlap, sx = 90 + p.answer[id].x * 140, sy = 90 + p.answer[id].y * 140;
    el.workspace.onpointerdown(event(id, sx, sy)); el.workspace.onpointermove(event(id, sx + tx * 140, sy + ty * 140)); el.workspace.onpointerup(event(id, sx + tx * 140, sy + ty * 140));
    assert(el.board.innerHTML.includes('overlap-warning')); assert.equal(el.status.className, 'danger'); assert.equal(completions, 0);
    el.workspace.onpointerdown(event(id, sx + tx * 140, sy + ty * 140)); el.workspace.onpointermove(event(id, 700, 700)); el.workspace.onpointerup(event(id, 700, 700)); place(id);
    place(3);
    assert.equal(completions, 1);
    assert.equal((el.board.innerHTML.match(/class="target-check"/g) ?? []).length, 5);
    assert.equal((el.board.innerHTML.match(/class="lamp-current"/g) ?? []).length, 5);
    assert(!el.board.innerHTML.includes('data-piece='));
    const solvedBoard = el.board.innerHTML;
    el.workspace.onpointerdown(event(0, 300, 300)); el.workspace.onpointermove(event(0, 700, 700)); el.workspace.onpointerup(event(0, 700, 700));
    el.workspace.onkeydown({ ...event(0, 300, 300), key: 'Enter' });
    assert.equal(el.board.innerHTML, solvedBoard); assert.equal(completions, 1);
  } finally { h.cleanup(); }
});

test('pause cancels captured drag and blocks pointer and keyboard changes until resumed', () => {
  const p = generatePuzzle('ui-test').puzzle;
  let paused = false;
  const h = harness({ puzzle: p, isPaused: () => paused }), { elements: el, event } = h;
  try {
    el.workspace.onpointerdown(event(0, 700, 700)); el.workspace.onpointermove(event(0, 710, 710));
    assert(!el.ghost.hidden); h.cancelDrag(); paused = true;
    assert(el.ghost.hidden); assert(!el.workspace.hasPointerCapture(1));
    const before = el.tray.children[0].innerHTML;
    el.workspace.onpointerdown(event(0, 700, 700)); el.workspace.onpointerup(event(0, 700, 700));
    el.workspace.onkeydown({ ...event(0, 700, 700), key: 'Enter' }); assert.equal(el.tray.children[0].innerHTML, before);
    paused = false;
    el.workspace.onpointerdown(event(0, 700, 700)); el.workspace.onpointerup(event(0, 700, 700));
    assert.notEqual(el.tray.children[0].innerHTML, before);
  } finally { h.cleanup(); }
});


test('stationary press highlights the selected tray piece and clears on cancellation', () => {
  const h = harness({ puzzle: generatePuzzle('ui-test').puzzle });
  const { elements: el, event } = h;
  try {
    assert.equal(el.tray.children[0].dataset.piece, '0');
    el.workspace.onpointerdown(event(0, 700, 700));
    assert.match(el.tray.children[0].innerHTML, /drag-highlight/);
    assert(!el.tray.children[1].innerHTML.includes('drag-highlight'));
    assert(el.ghost.hidden);
    el.workspace.onpointermove(event(0, 702, 701));
    assert.match(el.tray.children[0].innerHTML, /drag-highlight/);
    el.workspace.onlostpointercapture();
    assert(!el.tray.children[0].innerHTML.includes('drag-highlight'));
  } finally { h.cleanup(); }
});
