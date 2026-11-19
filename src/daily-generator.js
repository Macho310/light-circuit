import { dailyIdentity } from './daily-date.js';
import { generatePuzzle as version1 } from './versions/unique-spread-1/generator.js';

const generators = Object.freeze({ 'unique-spread-1': version1 });
export function generateDailyPuzzle(date, options = {}) {
  const identity = dailyIdentity(date);
  const generate = generators[identity.generatorVersion];
  if (!generate) throw new Error('Daily generator version unavailable');
  const result = generate(identity.seed, options);
  return { ...result, ...(result.puzzle ? { puzzle: { ...result.puzzle, daily: identity } } : {}) };
}
