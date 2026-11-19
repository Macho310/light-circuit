import { EDGES, POSITIONS, edgeKey, cells, solveCircuit, allPowered, absoluteText, meetsElectricalRules } from './circuit.js';

export const GENERATOR_VERSION = 'unique-spread-1';
export const DEFAULT_LIMITS = Object.freeze({ candidates: 1000, attemptsPerCandidate: 10000, searchNodes: 2000000 });
const RESISTANCES = [1, 2, 3, 4, 6];
const SHAPES = [
  [[0, 0], [1, 0]], [[0, 0], [1, 0], [2, 0]], [[0, 0], [1, 0], [0, 1]],
  [[0, 0], [1, 0], [1, 1], [1, 2]], [[0, 0], [1, 0], [2, 0], [1, 1]], [[0, 0], [1, 0], [1, 1], [2, 1]],
];
const LINKS = [[[0, 1]], [[0, 1], [1, 2]], [[0, 1], [0, 2]], [[0, 1], [1, 2], [2, 3]], [[0, 1], [1, 2], [1, 3]], [[0, 1], [1, 2], [2, 3]]];
const SHAPE_SETS = [];
for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) for (let c = 0; c < 6; c++) for (let d = 0; d < 6; d++) {
  const ids = [a, b, c, d];
  if (ids.reduce((n, i) => n + LINKS[i].length, 0) >= 8) SHAPE_SETS.push(ids);
}
const edgeIndex = new Map(EDGES.map(([a, b], i) => [edgeKey(a, b), i]));
const bit = (a, b) => 1 << edgeIndex.get(edgeKey(a, b));
const maskOf = edges => edges.reduce((mask, [a, b]) => mask | bit(a, b), 0);

// Mulberry32 with rejection sampling: integer choices have no modulo bias.
// Hash UTF-16 code units explicitly, avoiding locale and encoding differences.
export function seededRandom(seed) {
  if (typeof seed !== 'string' && !(Number.isSafeInteger(seed))) throw new TypeError('Seed must be a string or safe integer');
  let state = 2166136261;
  for (const code of `${typeof seed}:${seed}`.split('')) state = Math.imul(state ^ code.charCodeAt(0), 16777619) >>> 0;
  const uint = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  return n => {
    if (!Number.isInteger(n) || n < 1 || n > 0x100000000) throw new RangeError('Invalid random range');
    const limit = Math.floor(0x100000000 / n) * n;
    let value; do { value = uint(); } while (value >= limit);
    return value % n;
  };
}

export function placements(puzzle, id) {
  const seen = new Set(), out = [], targets = new Map();
  let lamp = 0;
  puzzle.parts.forEach((parts, j) => parts.forEach((type, k) => {
    if (type === 'lamp') targets.set(`${j}:${k}`, puzzle.targetFractions?.[lamp++] ?? '');
  }));
  for (const pos of POSITIONS) {
    const cs = cells(puzzle, pos, id);
    if (cs.some(([x, y]) => x < 0 || y < 0 || x > 3 || y > 3)) continue;
    const nodes = cs.map(([x, y]) => y * 4 + x);
    const edges = puzzle.links[id].map(([a, b]) => [nodes[a], nodes[b]]);
    const key = edges.map(([a, b], k) => {
      const type = puzzle.parts[id][k];
      if (type !== 'battery' && a > b) [a, b] = [b, a];
      return [type, puzzle.resistances[id][k], type === 'lamp' ? targets.get(`${id}:${k}`) : '', a, b].join(':');
    }).sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    const components = edges.map(([a, b], k) => ({ a, b, id, k, type: puzzle.parts[id][k], r: puzzle.resistances[id][k] }));
    out.push({ pos: { ...pos }, mask: maskOf(edges), nodes, components, key });
  }
  return out;
}

// Each line is horizontal in one row OR vertical in one column, not all edges
// touching the row/column. Only ideal wires are removed in the second branch.
export const LINES = [
  ...Array.from({ length: 4 }, (_, y) => EDGES.filter(([a, b]) => Math.floor(a / 4) === y && Math.floor(b / 4) === y)),
  ...Array.from({ length: 4 }, (_, x) => EDGES.filter(([a, b]) => a % 4 === x && b % 4 === x)),
].map(edges => new Set(edges.map(([a, b]) => edgeKey(a, b))));
export function necessaryLines(puzzle, positions = puzzle.answer, e = solveCircuit(puzzle, positions, { wireCurrents: false })) {
  if (!meetsElectricalRules(puzzle, e)) return LINES.map(() => false);
  return LINES.map(line => {
    if (e.components.some(c => c.type !== 'wire' && line.has(edgeKey(c.a, c.b)) && e.exactCurrents[c.id][c.k].n !== 0n)) return true;
    return !meetsElectricalRules(puzzle, solveCircuit(puzzle, positions, { removedWires: line, wireCurrents: false }));
  });
}

export function countSolutions(puzzle, { stopAt = 2, nodeLimit = DEFAULT_LIMITS.searchNodes } = {}) {
  const fixedMask = maskOf([...puzzle.wires, ...puzzle.fixed.map(c => [c.a, c.b])]);
  const options = [0, 1, 2, 3].map(id => placements(puzzle, id).filter(o => !(o.mask & fixedMask)));
  const positions = Array(4), chosen = Array(4);
  const fixed = puzzle.fixed.map((c, j) => ({ ...c, id: 4 + j, k: 0, fixed: true }));
  let checked = 0, visited = 0, solutions = 0, stopped = null, answer = null;
  function visit(id, mask) {
    if (stopped) return;
    if (visited >= nodeLimit) { stopped = 'node-limit'; return; }
    visited++;
    if (id === 4) {
      checked++;
      const components = [...chosen.flatMap(o => o.components), ...fixed];
      const e = solveCircuit(puzzle, positions, { wireCurrents: false, requirePowered: true, components });
      // Deliberately no spread predicate here: count ALL ordinary clear states.
      if (meetsElectricalRules(puzzle, e)) {
        solutions++;
        if (!answer) answer = positions.map(p => ({ ...p }));
        if (solutions >= stopAt) stopped = 'solution-limit';
      }
      return;
    }
    for (const option of options[id]) {
      if (option.mask & mask) continue;
      positions[id] = option.pos; chosen[id] = option;
      visit(id + 1, mask | option.mask);
      if (stopped) return;
    }
  }
  visit(0, fixedMask);
  return { solutions, complete: stopped === null, stopped, checked, visited, answer, placementOptions: options.map(o => o.length) };
}

function candidate(random, resistors, attemptLimit) {
  // The reference keeps a shape set for an internal attempt batch, then selects
  // another set for the next candidate. Preserve that sampling strategy.
  const ids = SHAPE_SETS[random(SHAPE_SETS.length)];
  for (let attempt = 1; attempt <= attemptLimit; attempt++) {
    const p = { shapes: ids.map(i => SHAPES[i].map(point => [...point])), links: ids.map(i => LINKS[i].map(link => [...link])), parts: [], resistances: [], fixed: [], wires: [], answer: [] };
    const slots = p.links.flatMap((links, id) => links.map((_, k) => ({ id, k })));
    p.parts = p.links.map(links => links.map(() => 'wire'));
    p.resistances = p.links.map(links => links.map(() => 0));
    const types = ['battery', ...Array(5).fill('lamp'), ...Array(resistors).fill('resistor')];
    for (let i = types.length - 1; i > 0; i--) { const j = random(i + 1); [types[i], types[j]] = [types[j], types[i]]; }
    for (let i = 0; i < types.length - 2; i++) {
      const eligible = i < 4 ? slots.filter(slot => slot.id === i) : slots;
      const slot = eligible[random(eligible.length)], type = types[2 + i];
      slots.splice(slots.indexOf(slot), 1);
      p.parts[slot.id][slot.k] = type;
      p.resistances[slot.id][slot.k] = type === 'battery' ? 0 : RESISTANCES[random(5)];
    }
    let used = 0, failed = false;
    for (let id = 0; id < 4; id++) {
      const options = placements(p, id).filter(o => !(o.mask & used));
      if (!options.length) { failed = true; break; }
      const option = options[random(options.length)];
      used |= option.mask; p.answer.push(option.pos);
    }
    if (failed) continue;
    const available = EDGES.map((_, i) => i).filter(i => !(used & (1 << i)));
    for (let k = 0; k < 2; k++) {
      const edge = available.splice(random(available.length), 1)[0];
      let [a, b] = EDGES[edge];
      const type = types[k];
      if (type === 'battery' && random(2)) [a, b] = [b, a];
      const r = type === 'battery' ? 0 : RESISTANCES[random(5)];
      p.fixed.push({ type, r, a, b }); p.parts.push([type]); p.resistances.push([r]);
    }
    for (let k = 0; k < 6; k++) p.wires.push([...EDGES[available.splice(random(available.length), 1)[0]]]);
    const e = solveCircuit(p, p.answer, { wireCurrents: false, requirePowered: true });
    if (!allPowered(e)) continue;
    const lamps = e.components.filter(c => c.type === 'lamp');
    if (lamps.some(c => e.exactCurrents[c.id][c.k].d > 24n)) continue;
    p.targets = lamps.map(c => Math.abs(e.currents[c.id][c.k]));
    p.targetFractions = lamps.map(c => absoluteText(e.exactCurrents[c.id][c.k]));
    return { puzzle: p, attempts: attempt };
  }
  return { puzzle: null, attempts: attemptLimit };
}

export function generatePuzzle(seed, { limits = {}, onProgress = () => {} } = {}) {
  const bounds = { ...DEFAULT_LIMITS, ...limits };
  for (const [key, value] of Object.entries(bounds)) if (!Number.isSafeInteger(value) || value < 1 || !(key in DEFAULT_LIMITS) || value > DEFAULT_LIMITS[key]) throw new RangeError('Limits must be positive integers no larger than the versioned defaults');
  const random = seededRandom(seed), resistors = random(5), start = performance.now();
  const stats = { resistors, candidates: 0, attempts: 0, checked: 0, rejected: { generation: 0, spread: 0, multiple: 0, incomplete: 0, noSolution: 0 } };
  for (let i = 0; i < bounds.candidates; i++) {
    stats.candidates++;
    const g = candidate(random, resistors, bounds.attemptsPerCandidate);
    stats.attempts += g.attempts;
    if (!g.puzzle) {
      stats.rejected.generation++;
      // A tighter caller budget may fail, but must never change the seeded
      // candidate sequence (and thereby return a different accepted puzzle).
      if (bounds.attemptsPerCandidate < DEFAULT_LIMITS.attemptsPerCandidate) return { puzzle: null, reason: 'attempt-limit', stats: { ...stats, elapsedMs: performance.now() - start } };
    }
    else if (!necessaryLines(g.puzzle).every(Boolean)) stats.rejected.spread++;
    else {
      const validation = countSolutions(g.puzzle, { nodeLimit: bounds.searchNodes });
      stats.checked += validation.checked;
      if (validation.solutions >= 2) stats.rejected.multiple++;
      else if (!validation.complete) {
        stats.rejected.incomplete++;
        if (bounds.searchNodes < DEFAULT_LIMITS.searchNodes) return { puzzle: null, reason: 'search-limit', stats: { ...stats, elapsedMs: performance.now() - start } };
      }
      else if (validation.solutions !== 1) stats.rejected.noSolution++;
      else {
        const puzzle = { ...g.puzzle, seed, generatorVersion: GENERATOR_VERSION,
          counts: { batteries: 1, lamps: 5, resistors, fixed: 2 },
          validation: { solutions: 1, complete: true, checked: validation.checked, necessaryLines: Array(8).fill(true) } };
        return { puzzle, stats: { ...stats, elapsedMs: performance.now() - start } };
      }
    }
    onProgress({ ...stats, rejected: { ...stats.rejected } });
  }
  return { puzzle: null, reason: 'attempt-limit', stats: { ...stats, elapsedMs: performance.now() - start } };
}
