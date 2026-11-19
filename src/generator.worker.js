import { generatePuzzle } from './generator.js';
import { generateDailyPuzzle } from './daily-generator.js';

self.onmessage = ({ data }) => {
  const { seed, requestId } = data;
  try {
    const result = (data.date !== undefined ? generateDailyPuzzle : generatePuzzle)(data.date ?? seed, {
      onProgress: stats => self.postMessage({ type: 'progress', requestId, stats }),
    });
    self.postMessage({ type: 'result', requestId, ...result });
  } catch (error) {
    self.postMessage({ type: 'error', requestId, message: error instanceof Error ? error.message : String(error) });
  }
};
