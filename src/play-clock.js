export function createPlayClock(now = () => performance.now()) {
  let started = false, paused = false, solved = false, elapsed = 0, since = 0;
  const read = () => elapsed + (started && !paused && !solved ? Math.max(0, now() - since) : 0);
  return {
    start() { if (!started) { started = true; since = now(); } },
    pause() { if (!started || paused || solved) return; elapsed = read(); paused = true; },
    resume() { if (!started || !paused || solved) return; since = now(); paused = false; },
    solve() { if (solved) return; elapsed = read(); solved = true; paused = false; },
    snapshot() { return { elapsed: read(), paused, solved }; },
  };
}

export function formatElapsed(milliseconds) {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function shareResult(date, milliseconds, url) {
  return `💡 Light Circuit ${date.replaceAll('-', '/')}\n⚡ ${formatElapsed(milliseconds)}でクリア！\n\n#LightCircuit\n${url}`;
}
