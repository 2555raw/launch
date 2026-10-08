"use client";

import { useCallback, useRef, useState } from "react";
import type { CommodityTheme } from "@/lib/content/commodities";
import { fmt } from "@/lib/format";

interface Props {
  theme: CommodityTheme;
  symbol: string;
  clickPower: number;
  disabled?: boolean;
  onClick: () => void;
}

interface Floater { id: number; x: number; y: number; text: string }
interface Spark { id: number; x: number; y: number; dx: number; dy: number }

/** The central deposit. Pure SVG, drawn from the commodity theme. */
export function Coin({ theme, symbol, clickPower, disabled, onClick }: Props) {
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [pressed, setPressed] = useState(false);
  const idRef = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);

  const handle = useCallback(
    (clientX: number, clientY: number) => {
      if (disabled) return;
      onClick();
      const rect = stageRef.current?.getBoundingClientRect();
      const x = rect ? clientX - rect.left : 0;
      const y = rect ? clientY - rect.top : 0;
      const id = ++idRef.current;
      setFloaters((f) => [...f.slice(-14), { id, x, y, text: `+${fmt(clickPower)}` }]);
      const ns: Spark[] = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 6 + Math.random();
        const d = 40 + Math.random() * 50;
        return { id: id * 10 + i, x, y, dx: Math.cos(a) * d, dy: Math.sin(a) * d };
      });
      setSparks((s) => [...s.slice(-30), ...ns]);
      setPressed(true);
      setTimeout(() => setPressed(false), 80);
      setTimeout(() => {
        setFloaters((f) => f.filter((x) => x.id !== id));
        setSparks((s) => s.filter((x) => Math.floor(x.id / 10) !== id));
      }, 1000);
    },
    [clickPower, disabled, onClick],
  );

  const c = theme.coin;
  return (
    <div ref={stageRef} className="coin-stage mx-auto w-full max-w-[320px] aspect-square">
      <div className="coin-halo" />
      <svg
        viewBox="0 0 200 200"
        role="button"
        aria-label={`${theme.verb} ${symbol}`}
        tabIndex={0}
        className={`coin-btn w-[88%] ${pressed ? "pressed" : ""} ${disabled ? "opacity-60 grayscale-[0.3]" : ""}`}
        onPointerDown={(e) => {
          e.preventDefault();
          handle(e.clientX, e.clientY);
        }}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            const r = stageRef.current?.getBoundingClientRect();
            handle(r ? r.left + r.width / 2 : 0, r ? r.top + r.height / 2 : 0);
          }
        }}
      >
        <defs>
          <radialGradient id="coinFace" cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor={c.light} />
            <stop offset="55%" stopColor={c.mid} />
            <stop offset="100%" stopColor={c.dark} />
          </radialGradient>
          <linearGradient id="coinRim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c.light} />
            <stop offset="50%" stopColor={c.dark} />
            <stop offset="100%" stopColor={c.light} />
          </linearGradient>
          <path id="ringText" d="M100,100 m-70,0 a70,70 0 1,1 140,0 a70,70 0 1,1 -140,0" />
        </defs>
        <circle cx="100" cy="104" r="96" fill={c.rim} opacity="0.9" />
        <circle cx="100" cy="100" r="96" fill="url(#coinRim)" />
        <circle cx="100" cy="100" r="88" fill="url(#coinFace)" />
        <circle cx="100" cy="100" r="80" fill="none" stroke={c.rim} strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="3 4" />
        <circle cx="100" cy="100" r="58" fill="none" stroke={c.rim} strokeOpacity="0.45" strokeWidth="2" />
        <text fontFamily="Rajdhani, sans-serif" fontWeight="700" fontSize="11" letterSpacing="3" fill={c.text} fillOpacity="0.8">
          <textPath href="#ringText" startOffset="2%">FOUNDRY • ${symbol} • COMMUNITY MINTED • SUPPLY BURNED •</textPath>
        </text>
        <text x="100" y="116" textAnchor="middle" fontFamily="Rajdhani, sans-serif" fontWeight="700" fontSize="56" fill={c.text} fillOpacity="0.9">
          {theme.glyph}
        </text>
        <ellipse cx="72" cy="60" rx="30" ry="14" fill="#fff" opacity="0.18" transform="rotate(-25 72 60)" />
      </svg>
      {floaters.map((f) => (
        <span key={f.id} className="float-num" style={{ left: f.x, top: f.y }}>
          {f.text}
        </span>
      ))}
      {sparks.map((s) => (
        <span key={s.id} className="spark" style={{ left: s.x, top: s.y, ["--dx" as string]: `${s.dx}px`, ["--dy" as string]: `${s.dy}px` }} />
      ))}
    </div>
  );
}
