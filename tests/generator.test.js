import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import { generatePuzzle, seededRandom, placements, countSolutions, necessaryLines, LINES } from '../src/generator.js';
import { cells, componentsAt, solveCircuit, allPowered, absoluteText, meetsElectricalRules, evaluatePuzzle, lampMatches } from '../src/circuit.js';

export function perimeterPuzzle() {
  const p = {
    shapes: Array.from({ length: 4 }, () => [[0, 0], [1, 0]]), links: Array.from({ length: 4 }, () => [[0, 1]]),
    parts: [['battery'], ['lamp'], ['lamp'], ['lamp'], ['lamp'], ['lamp']],
    resistances: [[0], [2], [2], [2], [2], [2]],
    fixed: [{ type: 'lamp', r: 2, a: 7, b: 11 }, { type: 'lamp', r: 2, a: 11, b: 15 }],
    wires: [[15, 14], [14, 13], [13, 12], [12, 8], [8, 4], [4, 0]],
    answer: [{ x: 0, y: 0, d: 0 }, { x: 1, y: 0, d: 0 }, { x: 2, y: 0, d: 0 }, { x: 3, y: 0, d: 1 }],
    targets: Array(5).fill(1.2), targetFractions: Array(5).fill('6/5'),
  };
  return p;
}

test('exact series, parallel, fixed battery, zero-current branch and short', () => {
  const p = perimeterPuzzle(), e = solveCircuit(p, p.answer);
  assert(evaluatePuzzle(p, p.answer).win);
  assert.equal(absoluteText(e.exactCurrents[0][0]), '6/5');
  for (const c of e.components.filter(c => c.type === 'lamp')) assert.equal(absoluteText(e.exactCurrents[c.id][c.k]), '6/5');
  // A dead-end resistor must prevent clear, even with every lamp on target.
  p.fixed.push({ type: 'resistor', r: 3, a: 1, b: 5 }); p.parts.push(['resistor']); p.resistances.push([3]);
  const dead = solveCircuit(p, p.answer);
  assert(lampMatches(p, dead).every(Boolean));
  assert(!allPowered(dead)); assert(!evaluatePuzzle(p, p.answer).win);
  p.wires.push([0, 1]); assert(solveCircuit(p, p.answer).short); assert(!evaluatePuzzle(p, p.answer).win);
  const parallel = { parts: [[], [], [], [], ['battery'], ['lamp'], ['resistor']], shapes: [], links: [], resistances: [[], [], [], [], [0], [3], [6]],
    fixed: [{ type: 'battery', r: 0, a: 0, b: 1 }, { type: 'lamp', r: 3, a: 4, b: 5 }, { type: 'resistor', r: 6, a: 8, b: 9 }],
    wires: [[0, 4], [4, 8], [1, 5], [5, 9]], targetFractions: ['4'] };
  const pe = solveCircuit(parallel, []);
  assert.equal(absoluteText(pe.exactCurrents[4][0]), '6');
  assert.equal(absoluteText(pe.exactCurrents[5][0]), '4');
  assert.equal(absoluteText(pe.exactCurrents[6][0]), '2');
  assert(allPowered(pe));
  parallel.fixed[1].r = 0; assert(solveCircuit(parallel, []).invalid);
});

test('rotation dedup includes values, lamp targets and battery polarity', () => {
  const p = perimeterPuzzle();
  assert.equal(placements(p, 0).length, 48); // Battery direction matters.
  assert.equal(placements(p, 1).length, 24); // Passive endpoint reversal does not.
  p.shapes[1] = [[0, 0], [1, 0], [2, 0]]; p.links[1] = [[0, 1], [1, 2]];
  p.parts[1] = ['lamp', 'lamp']; p.resistances[1] = [2, 2]; p.targetFractions = Array(6).fill('1');
  assert.equal(placements(p, 1).length, 16);
  p.targetFractions[1] = '2'; assert.equal(placements(p, 1).length, 32);
  p.targetFractions[1] = '1'; p.resistances[1][1] = 3; assert.equal(placements(p, 1).length, 32);
});

test('second ordinary solution is rejected even when it does not spread', () => {
  const p = perimeterPuzzle();
  assert(necessaryLines(p).some(v => !v));
  const fast = countSolutions(p), full = countSolutions(p, { stopAt: Infinity });
  assert.equal(fast.solutions, 2); assert.equal(fast.complete, false);
  assert(full.complete); assert(full.solutions > 1);
  assert.equal(countSolutions(p, { nodeLimit: 1 }).complete, false);
});

test('wire-cycle ambiguity is not a spread criterion; all line wires are removed', () => {
  const p = perimeterPuzzle();
  p.wires.push([4, 5], [5, 9], [9, 8]); // Ideal-wire loop on the return side.
  const e = solveCircuit(p, p.answer);
  assert(meetsElectricalRules(p, e)); assert(e.wireCurrents.includes(null));
  const lines = necessaryLines(p);
  assert.equal(lines[1], false); // Deleting row 1's wire leaves the perimeter intact.
  assert.equal(lines[2], false); // Same for row 2.
  assert.equal(lines[3], true); // Bottom return wires really are necessary.
  const removed = solveCircuit(p, p.answer, { removedWires: LINES[3] });
  assert(!meetsElectricalRules(p, removed));
  // Move one removable wire into a piece; deletion must cover movable wires too.
  p.wires = p.wires.filter(([a, b]) => !(a === 4 && b === 5));
  p.shapes[0].push([0, 1], [1, 1]); p.links[0].push([0, 2], [2, 3]);
  p.parts[0].push('wire', 'wire'); p.resistances[0].push(0, 0);
  p.wires = p.wires.filter(([a, b]) => !(a === 4 && b === 0));
  assert.equal(necessaryLines(p)[1], false);
});

test('same seed is byte-identical; all resistor counts and constraints; complete recount', () => {
  const seeds = new Map();
  for (let n = 0; seeds.size < 5; n++) { const seed = `test-${n}`, r = seededRandom(seed)(5); if (!seeds.has(r)) seeds.set(r, seed); }
  const shapeSets = new Set();
  for (const [resistors, seed] of seeds) {
    const a = generatePuzzle(seed), b = generatePuzzle(seed), p = a.puzzle;
    assert(p); assert.equal(JSON.stringify(p), JSON.stringify(b.puzzle));
    const { elapsedMs: ignoredA, ...statsA } = a.stats, { elapsedMs: ignoredB, ...statsB } = b.stats;
    assert.deepEqual(statsA, statsB); assert.equal(p.counts.resistors, resistors);
    assert.equal(p.fixed.length, 2); assert.equal(p.wires.length, 6);
    const counts = { battery: 0, lamp: 0, resistor: 0 };
    p.parts.flat().forEach(type => { if (type in counts) counts[type]++; });
    assert.deepEqual(counts, { battery: 1, lamp: 5, resistor: resistors });
    assert(p.parts.slice(0, 4).every(parts => parts.some(type => type !== 'wire')));
    p.parts.forEach((parts, id) => parts.forEach((type, k) => { if (type === 'lamp' || type === 'resistor') assert([1, 2, 3, 4, 6].includes(p.resistances[id][k])); }));
    const e = solveCircuit(p, p.answer);
    assert(allPowered(e)); assert(evaluatePuzzle(p, p.answer).win);
    assert(e.components.filter(c => c.type === 'lamp').every(c => e.exactCurrents[c.id][c.k].d <= 24n));
    assert(necessaryLines(p).every(Boolean));
    const full = countSolutions(p, { stopAt: Infinity });
    assert(full.complete); assert.equal(full.solutions, 1);
    shapeSets.add(JSON.stringify(p.shapes));
    for (let id = 0; id < 4; id++) assert(cells(p, p.answer[id], id).every(([x, y]) => x >= 0 && x < 4 && y >= 0 && y < 4));
  }
  assert(shapeSets.size > 1);
});

test('pruned search agrees with a separate exhaustive search without rotation dedup or powered pruning', () => {
  const p = generatePuzzle('ui-test').puzzle;
  const fixed = [...p.wires, ...p.fixed.map(c => [c.a, c.b])];
  const edgeKey = (a, b) => [a, b].sort((x, y) => x - y).join(':');
  const occupied = new Set(fixed.map(([a, b]) => edgeKey(a, b)));
  const options = [0, 1, 2, 3].map(id => {
    const out = [];
    for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) for (let d = 0; d < 4; d++) {
      const cs = p.shapes[id].map(([a, b]) => {
        const rotated = [[a, b], [-b, a], [-a, -b], [b, -a]][d];
        return [rotated[0] + x, rotated[1] + y];
      });
      if (cs.some(([a, b]) => a < 0 || a > 3 || b < 0 || b > 3)) continue;
      const edges = p.links[id].map(([a, b]) => edgeKey(cs[a][1] * 4 + cs[a][0], cs[b][1] * 4 + cs[b][0]));
      if (!edges.some(edge => occupied.has(edge))) out.push({ pos: { x, y, d }, edges });
    }
    return out;
  });
  const unique = new Set(), ps = Array(4);
  const targetByPart = new Map(); let i = 0;
  p.parts.forEach((parts, id) => parts.forEach((type, k) => { if (type === 'lamp') targetByPart.set(`${id}:${k}`, p.targetFractions[i++]); }));
  function visit(id, used) {
    if (id === 4) {
      const e = solveCircuit(p, ps, { wireCurrents: false });
      if (!meetsElectricalRules(p, e)) return;
      const signature = [0, 1, 2, 3].map(id => e.components.filter(c => c.id === id).map(c => {
        const ends = c.type === 'battery' ? `${c.a}:${c.b}` : edgeKey(c.a, c.b);
        return `${c.type}:${c.r}:${targetByPart.get(`${c.id}:${c.k}`) ?? ''}:${ends}`;
      }).sort().join('|')).join('/');
      unique.add(signature); return;
    }
    for (const o of options[id]) {
      if (o.edges.some(edge => used.has(edge))) continue;
      ps[id] = o.pos; visit(id + 1, new Set([...used, ...o.edges]));
    }
  }
  visit(0, occupied);
  assert.equal(unique.size, 1);
  assert.equal(countSolutions(p, { stopAt: Infinity }).solutions, unique.size);
});

test('reference archive examples remain unique and spread with exact arithmetic', () => {
  const examples = JSON.parse(readFileSync(new URL('./fixtures/reference-examples.json', import.meta.url)));
  for (const p of examples) {
    const e = solveCircuit(p, p.answer);
    p.targetFractions = e.components.filter(c => c.type === 'lamp').map(c => absoluteText(e.exactCurrents[c.id][c.k]));
    const lamps = e.components.filter(c => c.type === 'lamp');
    lamps.forEach((c, i) => assert(Math.abs(Math.abs(e.currents[c.id][c.k]) - p.targets[i]) < 1e-8));
    const full = countSolutions(p, { stopAt: Infinity });
    assert(full.complete); assert.equal(full.solutions, 1); assert(necessaryLines(p).every(Boolean));
  }
});

test('limits never publish an unverified candidate and do not reroll resistors', () => {
  const history = [];
  const g = generatePuzzle('limits', { limits: { candidates: 3, attemptsPerCandidate: 1000, searchNodes: 1 }, onProgress: s => history.push(s) });
  assert.equal(g.puzzle, null); assert(['attempt-limit', 'search-limit'].includes(g.reason)); assert(g.stats.candidates <= 3);
  assert(history.every(s => s.resistors === seededRandom('limits')(5)));
  assert.throws(() => generatePuzzle('x', { limits: { candidates: 0 } }), RangeError);
  assert.doesNotThrow(() => seededRandom(0)(5));
  const normal = generatePuzzle('test-0').puzzle;
  const capped = generatePuzzle('test-0', { limits: { attemptsPerCandidate: 500, searchNodes: 5000 } });
  if (capped.puzzle) assert.deepEqual(capped.puzzle, normal);
  const copy = generatePuzzle('ui-test').puzzle;
  copy.shapes[0][0][0] = 99;
  assert.notEqual(generatePuzzle('ui-test').puzzle.shapes[0][0][0], 99);
});

test('actual worker module returns the same puzzle without blocking the caller', async () => {
  const seed = 'worker-test', expected = generatePuzzle(seed).puzzle;
  const worker = new Worker(new URL('./worker-harness.js', import.meta.url));
  let ticks = 0;
  const timer = setInterval(() => ticks++, 5);
  try {
    const result = await new Promise((resolve, reject) => {
      worker.on('error', reject);
      worker.on('message', data => { if (data.type === 'result') resolve(data); if (data.type === 'error') reject(new Error(data.message)); });
      worker.postMessage({ requestId: 7, seed });
    });
    assert.equal(result.requestId, 7); assert.deepEqual(result.puzzle, expected); assert(ticks > 0);
  } finally { clearInterval(timer); await worker.terminate(); }
});
