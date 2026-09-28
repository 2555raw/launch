import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { GLStorm } from './glstorm';
import { StormEngine } from './engine';
import { BEAT_MS, skyGuard, webglDistrusted } from './skyGuard';
import type { Intensity, Scene, StormRenderer } from './types';

interface StormControls {
  running: boolean;
  intensity: Intensity;
  toggle(): void;
  setIntensity(i: Intensity): void;
  strike(): void;
  setCurrencies(codes: string[]): void;
  setScene(scene: Scene): void;
  lastPop?: string;
}

const Ctx = createContext<StormControls | null>(null);

const INTERACTIVE = 'a,button,input,select,textarea,label,summary,[role="button"],[data-solid],.glass,.card,.panel';

/** A canvas can only ever hold one kind of context, so each attempt gets its own. */
function freshCanvas(host: HTMLElement) {
  host.replaceChildren();
  const c = document.createElement('canvas');
  c.className = 'storm-canvas';
  c.setAttribute('aria-hidden', 'true');
  host.appendChild(c);
  return c;
}

/** The WebGL space sky where the browser can run it, the 2D one where it cannot. */
function makeRenderer(host: HTMLElement): StormRenderer {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  const forceGl = q.has('stormgl');
  // ?storm2d asks for the 2D sky; so does a browser whose WebGL sky crashed or lost its GPU lately
  if (!q.has('storm2d') && (forceGl || !webglDistrusted())) {
    // the heartbeat starts before the shaders compile: that is when a driver would fall over
    skyGuard.running();
    try {
      // ?stormgl keeps the WebGL sky even where the browser draws it in software
      return new GLStorm(freshCanvas(host), { allowSoftware: forceGl });
    } catch (e) {
      skyGuard.signedOff();
      console.warn('WebGL sky unavailable, using the 2D one:', (e as Error).message);
    }
  }
  return new StormEngine(freshCanvas(host));
}

export function StormProvider({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engine = useRef<StormRenderer | null>(null);
  const [running, setRunning] = useState(true);
  const [intensity, setIntensityState] = useState<Intensity>('storm');
  const [lastPop, setLastPop] = useState<string>();
  const wanted = useRef(true);
  const wantedIntensity = useRef<Intensity>('storm');
  const pending = useRef<{ codes?: string[]; scene?: Scene }>({});

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // The page first, the sky after: compiling the sky's shaders holds the main thread for a
    // moment (seconds on some GPU drivers, the first time), so the sky only starts once the
    // page has painted its content and the browser is idle.
    let cancelled = false;
    let teardown: (() => void) | undefined;
    let beat: number | undefined;
    const isGl = () => engine.current instanceof GLStorm;

    // while the WebGL sky is on screen it keeps a heartbeat (see skyGuard)
    const pulse = () => {
      clearInterval(beat);
      beat = undefined;
      if (!isGl()) return;
      if (document.hidden) {
        skyGuard.signedOff();
        return;
      }
      skyGuard.running();
      beat = window.setInterval(skyGuard.running, BEAT_MS);
    };

    // the GPU dropped the WebGL sky: carry on with the 2D one, and keep to it for a while
    const fallBack = () => {
      if (cancelled || !isGl()) return;
      skyGuard.failed();
      const old = engine.current!;
      old.stop();
      old.destroy?.();
      attach(new StormEngine(freshCanvas(host)));
      console.warn('The WebGL sky lost its GPU context; using the 2D one.');
    };

    const attach = (e: StormRenderer) => {
      engine.current = e;
      // a handle for browser tests and for poking at the sky from the console
      (window as unknown as { __storm?: StormRenderer }).__storm = e;
      e.onPop = (code) => setLastPop(code);
      if (e instanceof GLStorm) e.onFail = fallBack;
      if (pending.current.codes) e.setCurrencies(pending.current.codes);
      if (pending.current.scene) e.setScene(pending.current.scene);
      if (wantedIntensity.current !== 'storm') e.setIntensity(wantedIntensity.current);
      if (wanted.current && !document.hidden) e.start();
      setRunning(wanted.current);
      pulse();
    };

    const begin = () => {
      if (cancelled) return;
      attach(makeRenderer(host));

      let resizeTimer: number | undefined;
      const onResize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => engine.current?.resize(), 120);
      };
      const onVisibility = () => {
        const e = engine.current;
        if (!e) return;
        if (document.hidden) e.stop();
        else if (wanted.current) e.start();
        pulse();
      };
      const onPageHide = () => {
        if (isGl()) skyGuard.signedOff();
      };
      const onPointer = (ev: PointerEvent) => {
        const e = engine.current;
        if (ev.button !== 0 || !e) return;
        const target = ev.target as Element | null;
        if (target?.closest(INTERACTIVE)) return;
        if (!e.isRunning) return;
        e.pop(ev.clientX, ev.clientY);
      };
      window.addEventListener('resize', onResize);
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('pagehide', onPageHide);
      window.addEventListener('pointerdown', onPointer);
      teardown = () => {
        clearTimeout(resizeTimer);
        clearInterval(beat);
        if (isGl()) skyGuard.signedOff();
        const e = engine.current;
        e?.stop();
        e?.destroy?.();
        window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('pagehide', onPageHide);
        window.removeEventListener('pointerdown', onPointer);
        engine.current = null;
      };
    };
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const since = performance.now();
    let raf = 0;
    let timer: number | undefined;
    let idle: number | undefined;
    const wait = () => {
      const shown = (document.querySelector('main')?.textContent ?? '').trim().length > 0;
      if (!shown && performance.now() - since < 2500) {
        raf = requestAnimationFrame(wait);
        return;
      }
      // one more frame so the content is on screen, then the first idle moment
      raf = requestAnimationFrame(() => {
        if (w.requestIdleCallback) idle = w.requestIdleCallback(begin, { timeout: 600 });
        else timer = window.setTimeout(begin, 30);
      });
    };
    raf = requestAnimationFrame(wait);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      if (idle !== undefined) w.cancelIdleCallback?.(idle);
      teardown?.();
    };
  }, []);

  const toggle = useCallback(() => {
    const e = engine.current;
    if (!e) {
      // the sky hasn't started yet: remember the choice for when it does
      wanted.current = !wanted.current;
      setRunning(wanted.current);
      return;
    }
    if (e.isRunning) {
      wanted.current = false;
      e.stop();
    } else {
      wanted.current = true;
      e.start();
    }
    setRunning(e.isRunning);
  }, []);

  const setIntensity = useCallback((i: Intensity) => {
    wantedIntensity.current = i;
    engine.current?.setIntensity(i);
    setIntensityState(i);
  }, []);

  const strike = useCallback(() => engine.current?.strike(), []);
  const setCurrencies = useCallback((codes: string[]) => {
    pending.current.codes = codes;
    engine.current?.setCurrencies(codes);
  }, []);
  const setScene = useCallback((scene: Scene) => {
    pending.current.scene = scene;
    engine.current?.setScene(scene);
  }, []);

  return (
    <Ctx.Provider value={{ running, intensity, toggle, setIntensity, strike, setCurrencies, setScene, lastPop }}>
      <div ref={hostRef} className="storm-host" aria-hidden="true" />
      {children}
    </Ctx.Provider>
  );
}

export function useStorm() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStorm outside StormProvider');
  return v;
}
