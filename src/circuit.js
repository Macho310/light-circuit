// Shared by the UI and generator. Integer conductances and rational elimination
// keep zero-current, target and uniqueness decisions independent of FP rounding.
export const SIZE = 4;
export const VOLTAGE = 12;
export const edgeKey = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;
export const EDGES = [];
export const POSITIONS = [];
for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
  for (let d = 0; d < 4; d++) POSITIONS.push({ x, y, d });
  if (x < 3) EDGES.push([y * 4 + x, y * 4 + x + 1]);
  if (y < 3) EDGES.push([y * 4 + x, (y + 1) * 4 + x]);
}
export function cells(puzzle, position, id) {
  return puzzle.shapes[id].map(([x, y]) => {
    for (let d = 0; d < position.d; d++) [x, y] = [-y, x];
    return [x + position.x, y + position.y];
  });
}
export function componentsAt(puzzle, positions) {
  const components = [];
  positions.forEach((position, id) => {
    if (!position) return;
    const nodes = cells(puzzle, position, id).map(([x, y]) => y * 4 + x);
    puzzle.parts[id].forEach((type, k) => {
      const [a, b] = puzzle.links[id][k];
      components.push({ id, k, type, r: puzzle.resistances[id][k], a: nodes[a], b: nodes[b] });
    });
  });
  puzzle.fixed.forEach((c, j) => components.push({ ...c, id: 4 + j, k: 0, fixed: true }));
  return components;
}
export function lampEntries(puzzle) {
  return puzzle.parts.flatMap((parts, id) => parts.flatMap((type, k) => type === 'lamp' ? [{ id, k }] : []));
}
function gcd(a, b) { a = a < 0n ? -a : a; while (b) [a, b] = [b, a % b]; return a; }
export function rational(n, d = 1n) {
  if (d === 0n) throw new Error('Zero denominator');
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
const ZERO = rational(0n);
const sub = (a, b) => rational(a.n * b.d - b.n * a.d, a.d * b.d);
const add = (a, b) => rational(a.n * b.d + b.n * a.d, a.d * b.d);
const divide = (a, n) => rational(a.n, a.d * n);
const numeric = a => Number(a.n) / Number(a.d);
export const fractionText = a => a.d === 1n ? String(a.n) : `${a.n}/${a.d}`;
export const absoluteText = a => fractionText({ n: a.n < 0n ? -a.n : a.n, d: a.d });

// Bareiss elimination: all intermediate divisions are exact integers.
function solveIntegers(matrix, rhs) {
  const n = matrix.length;
  if (!n) return [];
  const a = matrix.map((row, i) => [...row.map(BigInt), BigInt(rhs[i])]);
  let previous = 1n;
  for (let k = 0; k < n - 1; k++) {
    if (a[k][k] === 0n) return null; // Grounded conductance matrix is positive definite.
    const pivot = a[k][k];
    for (let i = k + 1; i < n; i++) {
      for (let j = k + 1; j <= n; j++) {
        a[i][j] = (a[i][j] * pivot - a[i][k] * a[k][j]) / previous;
      }
      a[i][k] = 0n;
    }
    previous = pivot;
  }
  const values = Array(n);
  for (let i = n - 1; i >= 0; i--) {
    if (a[i][i] === 0n) return null;
    let v = rational(a[i][n]);
    for (let j = i + 1; j < n; j++) v = sub(v, rational(a[i][j] * values[j].n, values[j].d));
    values[i] = divide(v, a[i][i]);
  }
  return values;
}

export function solveCircuit(puzzle, positions, { removedWires = new Set(), wireCurrents = true, requirePowered = false, components = componentsAt(puzzle, positions) } = {}) {
  const parent = Array.from({ length: 16 }, (_, i) => i);
  const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const wireEdges = [...puzzle.wires.map(([a, b]) => ({ a, b })), ...components.filter(c => c.type === 'wire')]
    .filter(c => !removedWires.has(edgeKey(c.a, c.b)));
  for (const c of wireEdges) parent[find(c.a)] = find(c.b);
  const nets = parent.map((_, i) => find(i));
  const currents = puzzle.parts.map(parts => parts.map(() => 0));
  const exactCurrents = puzzle.parts.map(parts => parts.map(() => ZERO));
  const e = { nets, currents, exactCurrents, volts: Array(16).fill(null), exactVolts: Array(16).fill(null),
    components, wireCurrents: wireEdges.map(() => 0), short: false, invalid: false, total: 0 };
  const batteries = components.filter(c => c.type === 'battery');
  if (!batteries.length) return e;
  if (batteries.length !== 1) return { ...e, invalid: true };
  const battery = batteries[0], positive = nets[battery.a], negative = nets[battery.b];
  if (positive === negative) return { ...e, short: true, invalid: true, total: null };
  const passive = components.filter(c => c.type === 'lamp' || c.type === 'resistor');
  if (passive.some(c => ![1, 2, 3, 4, 6].includes(c.r))) return { ...e, invalid: true };
  const reached = new Set([positive, negative]), queue = [positive, negative];
  for (let t = 0; t < queue.length; t++) for (const c of passive) {
    const a = nets[c.a], b = nets[c.b], next = a === queue[t] ? b : b === queue[t] ? a : null;
    if (next !== null && !reached.has(next)) { reached.add(next); queue.push(next); }
  }
  // Safe necessary conditions only; pruning never excludes a powered solution.
  if (requirePowered) {
    const degrees = Array(16).fill(0);
    for (const c of [battery, ...passive]) {
      const a = nets[c.a], b = nets[c.b];
      if (a === b || !reached.has(a) || !reached.has(b)) return { ...e, unpowered: true };
      degrees[a]++; degrees[b]++;
    }
    if (degrees.some(d => d === 1)) return { ...e, unpowered: true };
  }
  const values = new Map([[positive, rational(12n)], [negative, ZERO]]);
  const vars = [...reached].filter(n => n !== positive && n !== negative);
  const index = new Map(vars.map((n, i) => [n, i]));
  const a = vars.map(() => vars.map(() => 0)), rhs = vars.map(() => 0);
  for (const c of passive) {
    const x = nets[c.a], y = nets[c.b], conductance = 12 / c.r;
    if (x === y || !reached.has(x)) continue;
    for (const [n, m] of [[x, y], [y, x]]) {
      const i = index.get(n), j = index.get(m);
      if (i === undefined) continue;
      a[i][i] += conductance;
      if (j !== undefined) a[i][j] -= conductance;
      else rhs[i] += conductance * numeric(values.get(m));
    }
  }
  const solved = solveIntegers(a, rhs);
  if (!solved) return { ...e, invalid: true };
  vars.forEach((n, i) => values.set(n, solved[i]));
  e.exactVolts = nets.map(n => values.get(n) ?? null);
  e.volts = e.exactVolts.map(v => v === null ? null : numeric(v));
  let total = ZERO;
  const injection = Array(16).fill(ZERO);
  for (const c of passive) {
    const v = e.exactVolts[c.a], w = e.exactVolts[c.b];
    const current = v === null || w === null ? ZERO : divide(sub(v, w), BigInt(c.r));
    exactCurrents[c.id][c.k] = current;
    currents[c.id][c.k] = numeric(current);
    injection[c.a] = sub(injection[c.a], current); injection[c.b] = add(injection[c.b], current);
    if (nets[c.a] === positive) total = add(total, current);
    if (nets[c.b] === positive) total = sub(total, current);
  }
  exactCurrents[battery.id][battery.k] = total;
  currents[battery.id][battery.k] = e.total = numeric(total);
  injection[battery.a] = add(injection[battery.a], total); injection[battery.b] = sub(injection[battery.b], total);
  if (wireCurrents) wireEdges.forEach((edge, id) => {
    const reached = new Set([edge.a]), q = [edge.a];
    for (let t = 0; t < q.length; t++) wireEdges.forEach((w, j) => {
      if (j === id) return;
      const n = w.a === q[t] ? w.b : w.b === q[t] ? w.a : null;
      if (n !== null && !reached.has(n)) { reached.add(n); q.push(n); }
    });
    const current = reached.has(edge.b) ? null : q.reduce((sum, n) => add(sum, injection[n]), ZERO);
    e.wireCurrents[id] = current === null ? null : numeric(current);
    if (edge.id !== undefined) { exactCurrents[edge.id][edge.k] = current; currents[edge.id][edge.k] = e.wireCurrents[id]; }
  });
  return e;
}

export function allPowered(e) {
  return !e.short && !e.invalid && !e.unpowered && e.components.filter(c => c.type !== 'wire')
    .every(c => { const value = e.exactCurrents[c.id][c.k]; return value !== null && value !== undefined && value.n !== 0n; });
}
export function lampMatches(puzzle, e) {
  const present = new Set(e.components.map(c => `${c.id}:${c.k}`));
  return lampEntries(puzzle).map(({ id, k }, i) => present.has(`${id}:${k}`) && !e.short && !e.invalid &&
    absoluteText(e.exactCurrents[id][k]) === puzzle.targetFractions[i]);
}
export function meetsElectricalRules(puzzle, e) {
  return allPowered(e) && lampMatches(puzzle, e).every(Boolean);
}
export function evaluatePuzzle(puzzle, positions) {
  const e = solveCircuit(puzzle, positions), edges = new Map();
  for (const c of [...puzzle.wires.map(([a, b]) => ({ a, b })), ...e.components]) {
    const key = edgeKey(c.a, c.b), edge = edges.get(key) ?? { a: Math.min(c.a, c.b), b: Math.max(c.a, c.b), count: 0 };
    edge.count++; edges.set(key, edge);
  }
  e.overlaps = [...edges.values()].filter(edge => edge.count > 1);
  e.matches = lampMatches(puzzle, e);
  e.win = positions.length === 4 && positions.every(Boolean) && !e.overlaps.length && meetsElectricalRules(puzzle, e);
  return e;
}
