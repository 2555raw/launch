import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { GLStorm } from './glstorm';
import { StormEngine } from './engine';
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

/** The WebGL space sky where the browser can run it, the 2D one where it cannot.
 *  A canvas can only ever hold one kind of context, so each attempt gets its own. */
function makeRenderer(host: HTMLElement): StormRenderer {
  const fresh = () => {
    host.replaceChildren();
    const c = document.createElement('canvas');
    c.className = 'storm-canvas';
    c.setAttribute('aria-hidden', 'true');
    host.appendChild(c);
    return c;
  };
  const forced2d = typeof location !== 'undefined' && new URLSearchParams(location.search).has('storm2d');
  if (!forced2d) {
    try {
      return new GLStorm(fresh());
    } catch (e) {
      console.warn('WebGL sky unavailable, using the 2D one:', (e as Error).message);
    }
  }
  return new StormEngine(fresh());
}

export function StormProvider({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engine = useRef<StormRenderer | null>(null);
  const [running, setRunning] = useState(true);
  const [intensity, setIntensityState] = useState<Intensity>('storm');
  const [lastPop, setLastPop] = useState<string>();
  const wanted = useRef(true);
  const pending = useRef<{ codes?: string[]; scene?: Scene }>({});

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const e = makeRenderer(host);
    engine.current = e;
    // a handle for browser tests and for poking at the sky from the console
    (window as unknown as { __storm?: StormRenderer }).__storm = e;
    e.onPop = (code) => setLastPop(code);
    if (pending.current.codes) e.setCurrencies(pending.current.codes);
    if (pending.current.scene) e.setScene(pending.current.scene);
    e.start();
    setRunning(e.isRunning);

    let resizeTimer: number | undefined;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => e.resize(), 120);
    };
    const onVisibility = () => {
      if (document.hidden) e.stop();
      else if (wanted.current) e.start();
    };
    const onPointer = (ev: PointerEvent) => {
      if (ev.button !== 0) return;
      const target = ev.target as Element | null;
      if (target?.closest(INTERACTIVE)) return;
      if (!e.isRunning) return;
      if (!e.pop(ev.clientX, ev.clientY)) e.strike(ev.clientX, ev.clientY);
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      e.stop();
      e.destroy?.();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointerdown', onPointer);
      engine.current = null;
    };
  }, []);

  const toggle = useCallback(() => {
    const e = engine.current;
    if (!e) return;
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
