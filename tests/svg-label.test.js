import test from 'node:test';
import assert from 'node:assert/strict';
import { svgLabel, labelWidth } from '../src/svg-label.js';

test('fractions stack numerator and denominator with a bar and separate unit', () => {
  for (const value of ['2/3A', '-12/17V', '123/456A']) {
    const svg = svgLabel([{ text: value }], 100, 40, 14);
    assert.match(svg, /class="fraction-bar"/);
    assert(svg.includes(`aria-label="${value}"`));
    assert(!svg.includes(`>${value}</text>`));
    assert.match(svg, /y="30.9"/);
    assert.match(svg, /y="48.4"/);
    assert.match(svg, />[AV]<\/text>/);
    assert(Number.isFinite(labelWidth([{ text: value }], 14)));
    assert(!svg.includes('NaN'));
  }
});

test('integers and unknown values stay on a single baseline', () => {
  for (const value of ['0A', '12V', '—']) {
    const svg = svgLabel([{ text: value }], 100, 40, 14);
    assert(!svg.includes('fraction-bar'));
    assert(svg.includes(`>${value}</text>`));
  }
});
