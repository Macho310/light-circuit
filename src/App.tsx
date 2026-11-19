import Rules from './Rules';
import { useEffect, useReducer, useRef, useState } from 'react';
import { mountGame } from './game.js';
import { createDailySession } from './daily-session.js';
import Calendar from './Calendar';
import { createPlayClock, formatElapsed, shareResult } from './play-clock.js';

function CircuitIcon() {
  return <svg className="home-icon" viewBox="0 0 160 160" role="img" aria-label="電球と電池の回路">
    <path d="M80 40H126V120H85M75 120H34V40H80" fill="none" stroke="#76b7ed" strokeWidth="4" strokeLinecap="round" />
    <circle cx="80" cy="40" r="19" fill="#d8cb91" stroke="#f5d65f" strokeWidth="2" />
    <path d="M75 105V135M85 112V128" stroke="#ead19c" strokeWidth="3" />
  </svg>;
}

type Session = ReturnType<typeof createDailySession>;
type Puzzle = NonNullable<ReturnType<typeof import('./daily-generator.js').generateDailyPuzzle>['puzzle']> & { daily: ReturnType<typeof import('./daily-date.js').dailyIdentity> };

export function Game({ puzzle, home }: { puzzle: Puzzle; home: () => void }) {
  const [clock] = useState(() => createPlayClock());
  const [timing, setTiming] = useState(clock.snapshot());
  const [copyMessage, setCopyMessage] = useState('');
  const resultText = shareResult(puzzle.daily.date, timing.elapsed, window.location.origin + window.location.pathname);
  const cancelDrag = useRef<() => void>(() => {});
  useEffect(() => {
    const cleanup = mountGame({ puzzle, isPaused: () => clock.snapshot().paused, onSolved: () => { clock.solve(); setTiming(clock.snapshot()); } });
    cancelDrag.current = cleanup.cancelDrag;
    clock.start();
    const interval = window.setInterval(() => setTiming(clock.snapshot()), 200);
    return () => { window.clearInterval(interval); cleanup(); };
  }, [puzzle, clock]);
  function pause() {
    if (clock.snapshot().solved) return;
    cancelDrag.current();
    if (clock.snapshot().paused) clock.resume(); else clock.pause();
    setTiming(clock.snapshot());
  }
  async function copy() {
    try { await navigator.clipboard.writeText(resultText); setCopyMessage('コピーしました'); }
    catch { setCopyMessage('コピーできませんでした。ブラウザのクリップボード許可を確認してください。'); }
  }
  return <GameDisplay date={puzzle.daily.date} timing={timing} home={home} pause={pause} copy={copy} copyMessage={copyMessage} resultText={resultText} />;
}

export function GameDisplay({ date, timing, home, pause, copy, copyMessage, resultText = '' }: { date: string; timing: ReturnType<ReturnType<typeof createPlayClock>['snapshot']>; home: () => void; pause: () => void; copy: () => void; copyMessage: string; resultText?: string }) {
  const shareDialog = useRef<HTMLDialogElement>(null);
  return <>
    <main className={`game-screen${timing.solved ? ' is-solved' : ''}${timing.paused ? ' is-paused' : ''}`}>
      <header><h1><button className="title-home" onClick={home} aria-label="Light Circuit、ホームに戻る">Light Circuit</button></h1></header>
      <div className={`time-card${timing.solved ? ' solved' : ''}`}>
        <time dateTime={date}>{date}</time>
        <div className="elapsed" aria-label="経過時間">{formatElapsed(timing.elapsed)}</div>
        <div className="solved-label" style={{ visibility: timing.solved ? 'visible' : 'hidden' }} aria-hidden={!timing.solved}>solved</div>
        {!timing.solved && <button className="pause-button" onClick={pause} aria-label={timing.paused ? '再開' : '一時停止'}>
          <svg viewBox="0 0 24 24" aria-hidden="true">{timing.paused ? <path d="M8 4L20 12L8 20Z" /> : <><rect x="5" y="4" width="5" height="16" rx="1" /><rect x="14" y="4" width="5" height="16" rx="1" /></>}</svg>
        </button>}
      </div>
      <div className="play-surface">
        <div id="workspace" inert={timing.paused || timing.solved} aria-hidden={timing.paused}>
          <svg id="board" viewBox="0 0 600 600" aria-label="回路盤面。ドラッグで配置、クリックで回転。" /><div id="tray" aria-label="部品置き場" hidden={timing.solved} />
        </div>
        {timing.paused && <div className="pause-cover">Pause</div>}
        {timing.solved && <div className="result-actions">
          <button onClick={home} aria-label="ホームに戻る"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11L12 3L21 11M5 10V21H10V15H14V21H19V10" /></svg></button>
          <button onClick={() => shareDialog.current?.showModal()} aria-label="結果を共有" aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 10.5L15.4 6.5M8.6 13.5L15.4 17.5" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="5" r="3" /><circle cx="18" cy="19" r="3" /></svg></button>
        </div>}
      </div>
    </main>
    {timing.solved && <dialog className="share-dialog" ref={shareDialog} aria-labelledby="share-title" onClick={event => { if (event.target === shareDialog.current) shareDialog.current?.close(); }}>
      <h2 id="share-title">結果を共有</h2>
      <textarea className="share-text" aria-label="共有する文章" readOnly value={resultText} rows={6} />
      <div className="share-actions"><button onClick={() => shareDialog.current?.close()}>閉じる</button><button onClick={copy}>コピー</button></div>
      <p className="share-message" role="status">{copyMessage}</p>
    </dialog>}
    <div id="ghost" hidden />
  </>;
}

export function Home({ session }: { session: Session }) {
  const state = session.getState();
  const calendar = useRef<HTMLDialogElement>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  return <main className="home-screen">
    <h1>Light Circuit</h1>
    <div className="home-date"><time dateTime={state.selectedDate}>{state.selectedDate}</time>
      <button className="calendar-button" aria-label="日付を選択" onClick={() => { session.refreshToday(); setCalendarOpen(true); calendar.current?.showModal(); }}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v5m8-5v5M4 11h16" /></svg>
      </button>
    </div>
    <CircuitIcon />
    <div className="home-actions"><button className="play-button" onClick={() => session.play()}>PLAY</button><button onClick={() => session.rules()}>HOW TO PLAY</button></div>
    <dialog className="date-dialog" aria-label="日付を選択" ref={calendar} onClose={() => setCalendarOpen(false)} onClick={event => { if (event.target === calendar.current) calendar.current?.close(); }}>
      {calendarOpen && <Calendar selected={state.selectedDate} today={state.today} select={session.selectDate} close={() => calendar.current?.close()} />}
    </dialog>
  </main>;
}

export default function App() {
  const [, refresh] = useReducer(n => n + 1, 0);
  const [session] = useState(() => createDailySession({ onChange: () => refresh() }));
  const state = session.getState();
  useEffect(() => {
    const update = () => session.refreshToday();
    const timer = window.setInterval(update, 60000);
    window.addEventListener('focus', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); session.dispose(); };
  }, [session]);
  if (state.screen === 'home') return <Home session={session} />;
  if (state.screen === 'game' && state.puzzle) return <Game puzzle={state.puzzle} home={session.home} />;
  if (state.screen === 'rules') return <main className="rules-screen"><header><h1><button className="title-home" onClick={session.home} aria-label="ホームに戻る">Light Circuit</button></h1></header><Rules /></main>;
  return <main className="loading-screen" aria-busy={state.screen === 'loading'}>
    <h1><button className="title-home" onClick={session.home} aria-label="ホームに戻る">Light Circuit</button></h1><time dateTime={state.selectedDate}>{state.selectedDate}</time>
    <p role="status">{state.screen === 'loading' ? 'Loading...' : state.error}</p>
  </main>;
}
