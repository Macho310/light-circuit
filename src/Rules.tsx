import { useEffect, useMemo, useRef, useState } from 'react';
import { renderPuzzlePreview } from './game.js';
import { tutorialPuzzle, tutorialPositions } from './tutorial-puzzle.js';

const lessons = [
  { title: '① クリックで回転　ドラックで移動' },
  { title: '② 電球に指定量の電流を流す' },
  { title: '③ すべての部品を使う' },
];

export function Demonstration({ lesson, step }: { lesson: number; step: number }) {
  const state = lesson === 1 ? 0 : step >= 3 ? 3 : 0;
  const frame = useMemo(() => renderPuzzlePreview(tutorialPuzzle, tutorialPositions(lesson, state), lesson === 1 ? {labelOffsets: {'8V': {x:50, y:0}}} : {}), [lesson, state]);
  const caption = lesson === 0 ? ['クリックで回転', '向きを合わせる', 'ドラッグで移動', '盤面に配置', '盤面に配置'][step]
    : lesson === 1 ? '上の電球は一致。下の電球はまだ不一致。'
    : state === 3 ? 'すべての素子に電流が流れてクリア！' : '電球はすべて一致。でも抵抗は 0A。';
  return <>
    <svg className={`tutorial-board${lesson === 1 ? ' tutorial-comparison' : ''}`} viewBox="0 0 600 730" role="img" aria-label={caption}>
      <rect x="1" y="1" width="598" height="598" rx="14" fill="#33363b" stroke="#555b64" />
      <g dangerouslySetInnerHTML={{__html:frame.board}} />
      <rect x="1" y="615" width="598" height="114" rx="12" fill="#2e3035" stroke="#555b64" strokeDasharray="5 4" />
      {frame.tray.map((piece: {viewBox: string; markup: string} | null, id: number) => <g key={id}>
        {piece && !(lesson === 0 && id === 0) ? <svg x={id * 150 + 5} y="620" width="140" height="104" viewBox={piece.viewBox} dangerouslySetInnerHTML={{__html:piece.markup}} />
          : !(lesson === 0 && id === 0 && step < 3) && <text x={id * 150 + 75} y="678" textAnchor="middle" fill="#878e98" fontSize="14">ピース {id + 1}</text>}
      </g>)}
      {lesson === 0 && step < 3 && <g className="tutorial-moving-piece" style={{ transform: step === 0 ? 'translate(75px, 672px) rotate(90deg) scale(.6)' : step === 1 ? 'translate(75px, 672px) rotate(0deg) scale(.6)' : 'translate(300px, 230px) rotate(0deg) scale(1)' }}>
        <g transform="translate(-160 -90)" dangerouslySetInnerHTML={{__html:frame.piece}} />
        <path d="M0 8V34L7 27L14 42L21 38L14 24H27Z" fill="#e8ecdf" stroke="#282a2e" strokeWidth="2" />
      </g>}
      {lesson === 1 && <>
        <rect x="102" y="196" width="116" height="84" rx="8" fill="none" stroke="#f5d65f" strokeWidth="2" />
        <rect x="102" y="336" width="116" height="84" rx="8" fill="none" stroke="#92979e" strokeWidth="2" />
        <path d="M228 192L234 198L246 184" fill="none" stroke="#f5d65f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="電流が一致" />
        <path d="M228 408L242 422M242 408L228 422" fill="none" stroke="#92979e" strokeWidth="3" strokeLinecap="round" role="img" aria-label="電流が不一致" />
      </>}
      {lesson === 2 && <g role="img" aria-label={frame.evaluation.win ? 'クリア' : '未クリア'} fill="none" stroke={frame.evaluation.win ? '#f5d65f' : '#adb2ba'} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d={frame.evaluation.win ? 'M284 562L296 574L318 548' : 'M288 550L312 574M312 550L288 574'} />
      </g>}
    </svg>
  </>;
}

function Lesson({ index, active }: { index: number; active: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    setStep(0);
    if (!active || index === 1) return;
    const timer = window.setInterval(() => setStep(value => (value + 1) % 5), 1500);
    return () => window.clearInterval(timer);
  }, [active, index]);
  return <section className="rule-lesson" aria-label={lessons[index].title}>
    <h3>{lessons[index].title}</h3>
    <div className="rule-video">{active && <Demonstration lesson={index} step={step} />}</div>
  </section>;
}

export default function Rules() {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  function slide(delta: number) {
    const node = track.current;
    if (!node) return;
    const next = Math.max(0, Math.min(2, active + delta));
    node.scrollTo({left: next * node.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  }
  return <div className="rules-carousel">
    {active > 0 && <button className="tutorial-prev" aria-label="前の説明へ" onClick={() => slide(-1)}>‹</button>}
    <div className="rules-lessons" ref={track} tabIndex={0} aria-label="ルール説明。左右にスライドして切り替え" onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); slide(event.key === 'ArrowLeft' ? -1 : 1); } }} onScroll={event => { const node = event.currentTarget; setActive(Math.round(node.scrollLeft / node.clientWidth)); }}>
      {lessons.map((lesson, index) => <Lesson key={lesson.title} index={index} active={index === active} />)}
    </div>
    {active < 2 && <button className="tutorial-next" aria-label="次の説明へ" onClick={() => slide(1)}>›</button>}
  </div>;
}
