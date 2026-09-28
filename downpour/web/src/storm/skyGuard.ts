/* Remembers, per browser, whether the WebGL sky can be trusted here. While it is on screen
 * the sky leaves a heartbeat, and it signs off when the page is hidden or closed. A
 * heartbeat that stopped without signing off means the last visit died with the sky
 * running (a GPU driver crash can take the whole browser down with it), so the next
 * visits get the 2D sky for a few days; a lost WebGL context counts the same. */

const KEY = 'starmint:sky';
/** How often the sky's heartbeat is written while it is on screen. */
export const BEAT_MS = 2000;
const HOLD_MS = 3 * 24 * 3600 * 1000;

type State = 'run' | 'ok' | '2d';

function read(): { state: State; at: number } | null {
  try {
    const v = localStorage.getItem(KEY);
    if (!v) return null;
    const [state, at] = v.split(':');
    return { state: state as State, at: Number(at) || 0 };
  } catch {
    return null;
  }
}

function write(state: State) {
  try {
    localStorage.setItem(KEY, `${state}:${Date.now()}`);
  } catch {
    /* no storage (a private window): nothing is remembered, nothing breaks */
  }
}

/** Whether this browser should get the 2D sky, after a recent crash or lost context. */
export function webglDistrusted(): boolean {
  const n = read();
  if (!n) return false;
  const age = Date.now() - n.at;
  if (n.state === '2d') return age < HOLD_MS;
  // a fresh heartbeat is another tab's sky, still running; an old one was never signed off
  if (n.state === 'run' && age > BEAT_MS * 3) {
    write('2d');
    return true;
  }
  return false;
}

export const skyGuard = {
  running: () => write('run'),
  signedOff: () => write('ok'),
  failed: () => write('2d'),
};
