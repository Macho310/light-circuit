import fs from 'node:fs';
import os from 'node:os';
import { generatePuzzle, seededRandom, GENERATOR_VERSION } from '../src/generator.js';

const perCount = Number(process.argv[2] ?? 20);
if (!Number.isInteger(perCount) || perCount < 1) throw new Error('Expected positive run count');
const result = { generatorVersion: GENERATOR_VERSION, environment: { node: process.version, platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model }, runs: [], summary: [] };
// Stratify only the benchmark. Production selects r once using its seeded RNG.
for (let r = 0; r <= 4; r++) {
  let n = 0, completed = 0;
  while (completed < perCount) {
    const seed = `benchmark-${r}-${n++}`;
    if (seededRandom(seed)(5) !== r) continue;
    const start = performance.now(), g = generatePuzzle(seed);
    result.runs.push({ seed, success: !!g.puzzle, ...g.stats, wallMs: performance.now() - start });
    completed++;
  }
  const rows = result.runs.filter(row => row.resistors === r), times = rows.map(row => row.wallMs).sort((a, b) => a - b);
  const percentile = q => times[Math.ceil(times.length * q) - 1];
  const summary = { resistors: r, runs: rows.length, success: rows.filter(row => row.success).length, medianMs: percentile(.5), p90Ms: percentile(.9), maxMs: times.at(-1), meanCandidates: rows.reduce((s, row) => s + row.candidates, 0) / rows.length, maxCandidates: Math.max(...rows.map(row => row.candidates)), meanAttempts: rows.reduce((s, row) => s + row.attempts, 0) / rows.length };
  result.summary.push(summary);
  console.log(JSON.stringify(summary));
}
fs.mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../docs/generation-benchmark.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
