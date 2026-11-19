import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { componentURL } from './react-markup.js';

const { default: Rules, Demonstration } = await import(componentURL(new URL('../src/Rules.tsx', import.meta.url)));


test('carousel shows three explanations without video controls or page counters', () => {
  const html = renderToStaticMarkup(createElement(Rules));
  assert.equal((html.match(/<section /g) || []).length, 3);
  assert(html.includes('rules-carousel'));
  assert(html.includes('次の説明へ'));
  for (const title of ['① クリックで回転　ドラックで移動', '② 電球に指定量の電流を流す', '③ すべての部品を使う']) assert(html.includes(title));
  assert(!/<p(?:\s|>)/.test(html));
  assert(!html.includes('もう一度'));
  assert(!html.includes('一時停止'));
  assert(!html.includes('demo-controls'));
});

test('all lessons use the actual game renderer and the same valid puzzle', async () => {
  const {tutorialPuzzle:p, tutorialPositions:positions} = await import('../src/tutorial-puzzle.js');
  const {evaluatePuzzle} = await import('../src/circuit.js');
  assert.equal(positions(0,0).filter(Boolean).length,0);
  assert.equal(positions(0,3).filter(Boolean).length,1);
  const first = evaluatePuzzle(p,positions(0,3));
  assert.equal(first.win,false);
  const second = evaluatePuzzle(p,positions(1,0));
  assert.deepEqual(second.matches,[true,false]);
  const before = evaluatePuzzle(p,positions(2,0));
  assert.deepEqual(before.matches,[true,true]);
  assert.equal(before.currents[2][0],0);
  assert.equal(before.win,false);
  const after = evaluatePuzzle(p,positions(2,3));
  assert.equal(after.win,true);
  assert(after.currents[2][0] !== 0);
  for(const [lesson,step] of [[0,0],[0,3],[1,0],[2,0],[2,3]]){
    const html=renderToStaticMarkup(createElement(Demonstration,{lesson,step}));
    assert(html.includes('fixed-component'));
    assert.equal((html.match(/class="lamp-symbol"/g)||[]).length,2);
    assert(!html.includes('tabindex="0"'));
    assert(!html.includes('NaN'));
  }
});

test('only the second lesson offsets 8V, and completion uses symbols', async () => {
  const {renderPuzzlePreview} = await import('../src/game.js');
  const {tutorialPuzzle:p, tutorialPositions:positions} = await import('../src/tutorial-puzzle.js');
  const original = renderPuzzlePreview(p,positions(1,0)).board;
  const adjusted = renderPuzzlePreview(p,positions(1,0),{labelOffsets:{'8V':{x:50,y:0}}}).board;
  assert(original.includes('x="221.32" y="414"'));
  assert(adjusted.includes('x="271.32" y="414"'));
  const labels = markup => markup.slice(markup.indexOf('<g class="potential-label"')).split('<g class="potential-label"');
  assert.deepEqual(labels(original).slice(0,3),labels(adjusted).slice(0,3));
  for (const step of [0,3]) {
    const html=renderToStaticMarkup(createElement(Demonstration,{lesson:2,step}));
    assert(!html.includes('>CLEAR<'));
    assert(!html.includes('>未クリア<'));
    assert(html.includes(step === 0 ? 'M288 550L312 574M312 550L288 574' : 'M284 562L296 574L318 548'));
  }
});
