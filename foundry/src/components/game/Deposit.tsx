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

/**
 * The deposit: every commodity piled together into one clickable mound.
 * Gold nuggets, an oil barrel, a silver ingot, a copper bar and lithium
 * crystals on a bed of ore. Original artwork, pure SVG.
 */
export function Deposit({ theme, symbol, clickPower, disabled, onClick }: Props) {
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
      const ns: Spark[] = Array.from({ length: 7 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 7 + Math.random();
        const d = 40 + Math.random() * 60;
        return { id: id * 10 + i, x, y, dx: Math.cos(a) * d, dy: Math.sin(a) * d - 20 };
      });
      setSparks((s) => [...s.slice(-35), ...ns]);
      setPressed(true);
      setTimeout(() => setPressed(false), 80);
      setTimeout(() => {
        setFloaters((f) => f.filter((x) => x.id !== id));
        setSparks((s) => s.filter((x) => Math.floor(x.id / 10) !== id));
      }, 1000);
    },
    [clickPower, disabled, onClick],
  );

  return (
    <div ref={stageRef} className="coin-stage mx-auto w-full max-w-[360px] aspect-square">
      <div className="coin-halo" />
      <svg
        viewBox="0 0 240 240"
        role="button"
        aria-label={`${theme.verb} ${symbol}`}
        tabIndex={0}
        className={`coin-btn w-[94%] ${pressed ? "pressed" : ""} ${disabled ? "opacity-60 grayscale-[0.3]" : ""}`}
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
          <radialGradient id="gold" cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#fff2a8" /><stop offset="50%" stopColor="#f2b734" /><stop offset="100%" stopColor="#8a5a0a" />
          </radialGradient>
          <linearGradient id="silver" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" /><stop offset="45%" stopColor="#c3cfdd" /><stop offset="100%" stopColor="#5f7089" />
          </linearGradient>
          <linearGradient id="copper" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffd2b0" /><stop offset="50%" stopColor="#d97a3f" /><stop offset="100%" stopColor="#6b2f10" />
          </linearGradient>
          <linearGradient id="barrel" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0d161c" /><stop offset="35%" stopColor="#2b3f4b" /><stop offset="70%" stopColor="#15232c" /><stop offset="100%" stopColor="#09100f" />
          </linearGradient>
          <linearGradient id="lithium" x1="0" y1="1" x2="0.4" y2="0">
            <stop offset="0%" stopColor="#4b3aa6" /><stop offset="55%" stopColor="#a08cff" /><stop offset="100%" stopColor="#efe9ff" />
          </linearGradient>
          <radialGradient id="rock" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#3a4455" /><stop offset="100%" stopColor="#12171f" />
          </radialGradient>
          <radialGradient id="oildrop" cx="40%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#3e5663" /><stop offset="100%" stopColor="#05090b" />
          </radialGradient>
        </defs>

        {/* ore mound */}
        <ellipse cx="120" cy="200" rx="104" ry="22" fill="#000" opacity="0.5" />
        <path d="M22 196 C 30 150, 70 120, 120 118 C 170 120, 212 150, 218 196 Z" fill="url(#rock)" />
        <path d="M40 186 l10-14 12 10 -8 12z M170 184 l14-12 10 10 -12 10z M100 192 l8-10 12 6 -6 10z" fill="#1c2430" />

        {/* oil barrel (back left) */}
        <g transform="translate(40 92)">
          <rect x="0" y="0" width="54" height="78" rx="8" fill="url(#barrel)" />
          <ellipse cx="27" cy="2" rx="27" ry="8" fill="#3b525f" />
          <rect x="0" y="16" width="54" height="5" fill="#48ceaa" opacity="0.75" />
          <rect x="0" y="54" width="54" height="5" fill="#48ceaa" opacity="0.75" />
          <path d="M27 30 c-6 8 -7 12 -7 16 a7 7 0 0 0 14 0 c0-4 -1-8 -7-16z" fill="url(#oildrop)" stroke="#48ceaa" strokeOpacity="0.7" />
        </g>

        {/* lithium crystals (back center) */}
        <g>
          <path d="M112 128 l10 -50 10 50z" fill="url(#lithium)" />
          <path d="M126 130 l14 -36 8 36z" fill="url(#lithium)" opacity="0.85" />
          <path d="M100 132 l6 -32 10 32z" fill="url(#lithium)" opacity="0.8" />
          <path d="M122 78 l0 50" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" />
        </g>

        {/* silver ingot (back right) */}
        <g transform="translate(140 108)">
          <path d="M8 36 L18 4 H66 L76 36 Z" fill="url(#silver)" />
          <path d="M8 36 H76 L72 48 H12 Z" fill="#6f7f96" />
          <path d="M18 4 H66 L62 12 H22 Z" fill="#fff" opacity="0.5" />
          <text x="42" y="30" textAnchor="middle" fontFamily="Rajdhani, sans-serif" fontWeight="700" fontSize="12" fill="#2d3542">Ag</text>
        </g>

        {/* copper bar (front right) */}
        <g transform="translate(150 150)">
          <path d="M4 30 L12 6 H60 L68 30 Z" fill="url(#copper)" />
          <path d="M4 30 H68 L64 40 H8 Z" fill="#6b2f10" />
          <text x="36" y="25" textAnchor="middle" fontFamily="Rajdhani, sans-serif" fontWeight="700" fontSize="11" fill="#4a2109">Cu</text>
        </g>

        {/* gold nuggets (front center / left) */}
        <g>
          <path d="M64 176 l12-18 20-6 16 10 4 18 -14 10 -24 -2z" fill="url(#gold)" stroke="#8a5a0a" strokeWidth="1" />
          <path d="M96 164 l10-14 18-2 12 12 -2 16 -16 8 -18 -6z" fill="url(#gold)" stroke="#8a5a0a" strokeWidth="1" />
          <path d="M122 150 l8-10 14 0 8 10 -4 12 -14 4 -12 -6z" fill="url(#gold)" stroke="#8a5a0a" strokeWidth="1" />
          <path d="M74 170 l8-10 10-2" stroke="#fff6c7" strokeWidth="2" strokeOpacity="0.7" fill="none" />
          <path d="M104 160 l6-8 8-1" stroke="#fff6c7" strokeWidth="2" strokeOpacity="0.7" fill="none" />
          <path d="M128 150 l5-6 7 0" stroke="#fff6c7" strokeWidth="2" strokeOpacity="0.7" fill="none" />
        </g>

        {/* small ore chunks */}
        <path d="M44 190 l6-8 8 4 -2 8z M196 190 l6-6 6 6 -4 6z M150 196 l4-6 8 2 -2 6z" fill="#2a3442" stroke="#0e1218" />
        <text x="120" y="226" textAnchor="middle" fontFamily="Rajdhani, sans-serif" fontWeight="700" fontSize="11" letterSpacing="4" fill="#94a3b8" opacity="0.8">
          COMMODITY DEPOSIT
        </text>
      </svg>
      {floaters.map((f) => (
        <span key={f.id} className="float-num" style={{ left: f.x, top: f.y }}>{f.text}</span>
      ))}
      {sparks.map((s) => (
        <span key={s.id} className="spark" style={{ left: s.x, top: s.y, ["--dx" as string]: `${s.dx}px`, ["--dy" as string]: `${s.dy}px` }} />
      ))}
    </div>
  );
}
