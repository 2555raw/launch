import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { StormEngine, type Intensity, type Scene } from './engine';

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

export function StormProvider({ children }: { children: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engine = useRef<StormEngine | null>(null);
  const [running, setRunning] = useState(true);
  const [intensity, setIntensityState] = useState<Intensity>('storm');
  const [lastPop, setLastPop] = useState<string>();
  const wanted = useRef(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const e = new StormEngine(canvas);
    engine.current = e;
    e.onPop = (code) => setLastPop(code);
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
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointerdown', onPointer);
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
  const setCurrencies = useCallback((codes: string[]) => engine.current?.setCurrencies(codes), []);
  const setScene = useCallback((scene: Scene) => engine.current?.setScene(scene), []);

  return (
    <Ctx.Provider value={{ running, intensity, toggle, setIntensity, strike, setCurrencies, setScene, lastPop }}>
      <canvas ref={canvasRef} className="storm-canvas" aria-hidden="true" />
      {children}
    </Ctx.Provider>
  );
}

export function useStorm() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStorm outside StormProvider');
  return v;
}
