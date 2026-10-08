'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TILE_H, TILE_W, toGrid } from './sprites';

export interface Camera {
  zoom: number;
  ox: number;
  oy: number;
}

export interface IsoCanvasProps {
  gridSize: number;
  draw: (ctx: CanvasRenderingContext2D, cam: Camera, size: { w: number; h: number }) => void;
  onTileClick?: (gx: number, gy: number, e: { shift: boolean }) => void;
  onTileHover?: (gx: number, gy: number) => void;
  onTileDragStart?: (gx: number, gy: number) => boolean; // return true to capture the drag (no panning)
  onTileDrag?: (gx: number, gy: number) => void;
  onTileDragEnd?: (gx: number, gy: number) => void;
  /** bumps redraw */
  revision?: number;
  className?: string;
  animate?: boolean;
}

/**
 * Generic isometric canvas with pan (drag), zoom (wheel / pinch) and grid hit testing.
 * Village and battle screens supply their own `draw` routine.
 */
export function IsoCanvas(props: IsoCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef<Camera>({ zoom: 1, ox: 0, oy: 0 });
  const [, setTick] = useState(0);
  const drag = useRef<{ x: number; y: number; moved: boolean; captured: boolean; ox: number; oy: number } | null>(null);
  const pinch = useRef<number | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const fit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const g = propsRef.current.gridSize;
    // Fit the whole grid, then zoom in on the centre where a village actually lives (the map stays pannable).
    const fitAll = Math.min(w / (g * TILE_W * 1.05), h / (g * TILE_H * 1.15));
    const zoom = Math.min(1.6, Math.max(fitAll * 1.9, 0.45));
    camRef.current = { zoom, ox: w / 2, oy: h / 2 - (g * TILE_H * zoom) / 2 };
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    propsRef.current.draw(ctx, camRef.current, { w, h });
  }, []);

  useEffect(() => {
    fit();
    render();
    const onResize = () => {
      fit();
      render();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fit, render, props.gridSize]);

  useEffect(() => {
    render();
  }, [render, props.revision]);

  useEffect(() => {
    if (!props.animate) return;
    let raf = 0;
    const loop = () => {
      render();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [props.animate, render]);

  const gridAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    const { zoom, ox, oy } = camRef.current;
    return toGrid(clientX - r.left, clientY - r.top, zoom, ox, oy);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const g = gridAt(e.clientX, e.clientY);
    const captured = propsRef.current.onTileDragStart?.(Math.floor(g.gx), Math.floor(g.gy)) ?? false;
    drag.current = { x: e.clientX, y: e.clientY, moved: false, captured, ox: camRef.current.ox, oy: camRef.current.oy };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gridAt(e.clientX, e.clientY);
    propsRef.current.onTileHover?.(Math.floor(g.gx), Math.floor(g.gy));
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
    if (drag.current.captured) {
      propsRef.current.onTileDrag?.(Math.floor(g.gx), Math.floor(g.gy));
    } else {
      camRef.current.ox = drag.current.ox + dx;
      camRef.current.oy = drag.current.oy + dy;
      render();
    }
  };
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gridAt(e.clientX, e.clientY);
    if (drag.current) {
      if (drag.current.captured) propsRef.current.onTileDragEnd?.(Math.floor(g.gx), Math.floor(g.gy));
      else if (!drag.current.moved) propsRef.current.onTileClick?.(Math.floor(g.gx), Math.floor(g.gy), { shift: e.shiftKey });
    }
    drag.current = null;
    render();
  };
  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const cam = camRef.current;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const next = Math.min(3, Math.max(0.35, cam.zoom * factor));
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    cam.ox = mx - (mx - cam.ox) * (next / cam.zoom);
    cam.oy = my - (my - cam.oy) * (next / cam.zoom);
    cam.zoom = next;
    render();
    setTick((t) => t + 1);
  };
  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (pinch.current) {
        const cam = camRef.current;
        cam.zoom = Math.min(3, Math.max(0.35, cam.zoom * (d / pinch.current)));
        render();
      }
      pinch.current = d;
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className={`block h-full w-full touch-none select-none ${props.className ?? ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (drag.current = null)}
      onWheel={onWheel}
      onTouchMove={onTouchMove}
      onTouchEnd={() => (pinch.current = null)}
      onDoubleClick={() => {
        fit();
        render();
      }}
    />
  );
}
