import { todayInTokyo, canSelectDate, dailyIdentity } from './daily-date.js';

export function createDailySession({ now = () => new Date(), createWorker = () => new Worker(new URL('./generator.worker.js', import.meta.url), { type: 'module' }), onChange = () => {} } = {}) {
  const today = todayInTokyo(now());
  let state = { screen: 'home', selectedDate: today, today, puzzle: null, error: '' };
  let worker = null, requestId = 0, disposed = false;
  const update = patch => { state = { ...state, ...patch }; onChange(state); };
  const cancel = () => { requestId++; worker?.terminate(); worker = null; };
  function home() { if (disposed) return; cancel(); update({ screen: 'home', today: todayInTokyo(now()), puzzle: null, error: '' }); }
  function selectDate(date) {
    const today = todayInTokyo(now());
    if (disposed || state.screen !== 'home' || !canSelectDate(date, today)) return false;
    update({ selectedDate: date, today }); return true;
  }
  function play() {
    if (disposed || state.screen !== 'home' || worker) return false;
    if (!canSelectDate(state.selectedDate, todayInTokyo(now()))) return false;
    const identity = dailyIdentity(state.selectedDate), id = ++requestId;
    update({ screen: 'loading', error: '' });
    const fail = () => { worker?.terminate(); worker = null; update({ screen: 'error', error: 'この日の問題を生成できませんでした。ホームから同じ日付で再試行できます。' }); };
    try {
      worker = createWorker();
      worker.onmessage = ({ data }) => {
        if (disposed || id !== requestId || data.requestId !== id || state.screen !== 'loading') return;
        if (data.type === 'progress') return;
        if (data.type === 'error') { fail(); return; }
        if (data.type !== 'result') return;
        const p = data.puzzle;
        if (!p || !p.validation?.complete || p.validation.solutions !== 1 || p.seed !== identity.seed || p.generatorVersion !== identity.generatorVersion || p.daily?.date !== identity.date) { fail(); return; }
        worker?.terminate(); worker = null;
        update({ screen: 'game', puzzle: p });
      };
      worker.onerror = event => { if (disposed || id !== requestId) return; event.preventDefault(); fail(); };
      worker.postMessage({ date: identity.date, requestId: id });
    } catch { fail(); }
    return true;
  }
  return {
    getState: () => state, selectDate, play, home,
    rules() { if (!disposed && state.screen === 'home') update({ screen: 'rules' }); },
    refreshToday() { if (!disposed) update({ today: todayInTokyo(now()) }); },
    dispose() { disposed = true; cancel(); },
  };
}
