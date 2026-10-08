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
 * The deposit: every commodity piled on a bed of ore. Gold nuggets, a steel
 * oil drum, a stamped silver ingot, a cast copper bar and lithium crystals.
 * Original SVG with lighting, texture and shadow filters.
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
      setFloaters((f) => [...f.slice(-14), { id, x, y, text: `+${fmt(clickPower)} ${theme.unitShort}` }]);
      const ns: Spark[] = Array.from({ length: 8 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 8 + Math.random();
        const d = 40 + Math.random() * 70;
        return { id: id * 10 + i, x, y, dx: Math.cos(a) * d, dy: Math.sin(a) * d - 30 };
      });
      setSparks((s) => [...s.slice(-40), ...ns]);
      setPressed(true);
      setTimeout(() => setPressed(false), 80);
      setTimeout(() => {
        setFloaters((f) => f.filter((x) => x.id !== id));
        setSparks((s) => s.filter((x) => Math.floor(x.id / 10) !== id));
      }, 1000);
    },
    [clickPower, disabled, onClick, theme.unitShort],
  );

  return (
    <div ref={stageRef} className="coin-stage mx-auto w-full max-w-[380px] aspect-square">
      <div className="coin-halo" />
      <svg
        viewBox="0 0 240 240"
        role="button"
        aria-label={`${theme.verb} ${symbol}`}
        tabIndex={0}
        className={`coin-btn w-[96%] ${pressed ? "pressed" : ""} ${disabled ? "opacity-60 grayscale-[0.3]" : ""}`}
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
          {/* lighting & texture */}
          <filter id="rockTex" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0" result="grain" />
            <feComposite in="grain" in2="SourceGraphic" operator="in" result="g2" />
            <feBlend in="SourceGraphic" in2="g2" mode="multiply" />
          </filter>
          <filter id="metalTex" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.02 0.6" numOctaves="2" seed="3" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.22 0" result="grain" />
            <feComposite in="grain" in2="SourceGraphic" operator="in" result="g2" />
            <feBlend in="SourceGraphic" in2="g2" mode="overlay" />
          </filter>
          <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
          <radialGradient id="goldA" cx="30%" cy="25%" r="85%">
            <stop offset="0%" stopColor="#fff7c2" /><stop offset="35%" stopColor="#f6c445" /><stop offset="75%" stopColor="#b7801a" /><stop offset="100%" stopColor="#5e3b06" />
          </radialGradient>
          <linearGradient id="goldFacet" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffe892" /><stop offset="100%" stopColor="#9c6a0c" />
          </linearGradient>
          <linearGradient id="silverTop" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#dfe7f1" /><stop offset="40%" stopColor="#ffffff" /><stop offset="60%" stopColor="#b9c5d4" /><stop offset="100%" stopColor="#8a99ad" />
          </linearGradient>
          <linearGradient id="silverSide" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8d9db1" /><stop offset="100%" stopColor="#4d5b6d" />
          </linearGradient>
          <linearGradient id="copperTop" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f7b98d" /><stop offset="45%" stopColor="#e28a52" /><stop offset="100%" stopColor="#9a4a1f" />
          </linearGradient>
          <linearGradient id="copperSide" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8f4019" /><stop offset="100%" stopColor="#4a1f0a" />
          </linearGradient>
          <linearGradient id="drum" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0c1418" /><stop offset="22%" stopColor="#36505c" /><stop offset="45%" stopColor="#1b2b33" /><stop offset="80%" stopColor="#101a1f" /><stop offset="100%" stopColor="#05090b" />
          </linearGradient>
          <linearGradient id="drumBand" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1f5c4c" /><stop offset="40%" stopColor="#5fe0bd" /><stop offset="100%" stopColor="#1a4a3e" />
          </linearGradient>
          <linearGradient id="lith" x1="0" y1="1" x2="0.5" y2="0">
            <stop offset="0%" stopColor="#3a2b8f" /><stop offset="50%" stopColor="#9d86ff" /><stop offset="100%" stopColor="#f3efff" />
          </linearGradient>
          <linearGradient id="lithSide" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#2a1f6e" /><stop offset="100%" stopColor="#6d5ccf" />
          </linearGradient>
          <radialGradient id="rock" cx="45%" cy="25%" r="75%">
            <stop offset="0%" stopColor="#4a5566" /><stop offset="60%" stopColor="#242c38" /><stop offset="100%" stopColor="#0d1117" />
          </radialGradient>
          <radialGradient id="ground" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000" stopOpacity="0.7" /><stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ground shadow + ore mound */}
        <ellipse cx="120" cy="204" rx="112" ry="26" fill="url(#ground)" />
        <path d="M18 198 C 26 150, 66 118, 120 116 C 174 118, 214 150, 222 198 Z" fill="url(#rock)" filter="url(#rockTex)" />
        <path d="M30 192 l12-16 14 10 -8 14z M166 188 l16-14 12 12 -14 10z M92 194 l10-12 14 6 -6 12z M196 194 l10-8 8 6 -6 8z" fill="#1a212b" />
        <path d="M30 192 l12-16 M166 188 l16-14 M92 194 l10-12" stroke="#5b6778" strokeWidth="1" strokeOpacity="0.6" />
        {/* embedded ore glints */}
        <circle cx="70" cy="170" r="1.6" fill="#ffe892" opacity="0.8" />
        <circle cx="150" cy="180" r="1.3" fill="#ffe892" opacity="0.7" />
        <circle cx="200" cy="184" r="1.2" fill="#dfe7f1" opacity="0.8" />

        {/* steel oil drum (back left) */}
        <g transform="translate(36 86)">
          <ellipse cx="29" cy="86" rx="31" ry="8" fill="#000" opacity="0.45" filter="url(#softShadow)" />
          <rect x="0" y="4" width="58" height="82" rx="6" fill="url(#drum)" filter="url(#metalTex)" />
          <ellipse cx="29" cy="4" rx="29" ry="8" fill="#3c535f" />
          <ellipse cx="29" cy="4" rx="24" ry="6" fill="#22333b" />
          <circle cx="36" cy="3" r="2.2" fill="#0a1114" stroke="#5c7580" strokeWidth="0.6" />
          <rect x="0" y="20" width="58" height="6" fill="url(#drumBand)" opacity="0.9" />
          <rect x="0" y="62" width="58" height="6" fill="url(#drumBand)" opacity="0.9" />
          <rect x="0" y="20" width="58" height="1" fill="#fff" opacity="0.25" />
          <rect x="0" y="62" width="58" height="1" fill="#fff" opacity="0.25" />
          {/* rivets */}
          {[8, 20, 32, 44].map((x) => (
            <g key={x}><circle cx={x + 3} cy="23" r="1" fill="#0b1316" /><circle cx={x + 3} cy="65" r="1" fill="#0b1316" /></g>
          ))}
          {/* drop emblem */}
          <path d="M29 32 c-7 9 -8 13 -8 18 a8 8 0 0 0 16 0 c0-5 -1-9 -8-18z" fill="#0a1316" stroke="#5fe0bd" strokeOpacity="0.8" strokeWidth="1" />
          <path d="M25 48 a4 4 0 0 0 4 4" stroke="#5fe0bd" strokeOpacity="0.6" strokeWidth="1" fill="none" />
          <rect x="4" y="8" width="3" height="74" fill="#fff" opacity="0.08" />
        </g>

        {/* lithium crystals (back center) */}
        <g>
          <path d="M108 130 l12 -58 12 58z" fill="url(#lith)" />
          <path d="M120 72 l12 58 -12 0z" fill="url(#lithSide)" opacity="0.9" />
          <path d="M126 132 l14 -40 10 40z" fill="url(#lith)" opacity="0.95" />
          <path d="M140 92 l10 40 -10 0z" fill="url(#lithSide)" opacity="0.9" />
          <path d="M98 134 l6 -34 10 34z" fill="url(#lith)" opacity="0.9" />
          <path d="M104 100 l10 34 -10 0z" fill="url(#lithSide)" opacity="0.85" />
          <path d="M120 72 l0 58" stroke="#fff" strokeOpacity="0.55" strokeWidth="1" />
          <path d="M140 92 l0 40" stroke="#fff" strokeOpacity="0.45" strokeWidth="0.8" />
          <path d="M120 74 l-4 20" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" filter="url(#glow)" />
        </g>

        {/* stamped silver ingot (back right) */}
        <g transform="translate(138 106)">
          <ellipse cx="42" cy="50" rx="42" ry="7" fill="#000" opacity="0.4" filter="url(#softShadow)" />
          <path d="M6 36 L16 4 H68 L78 36 Z" fill="url(#silverTop)" filter="url(#metalTex)" />
          <path d="M6 36 H78 L74 48 H10 Z" fill="url(#silverSide)" />
          <path d="M16 4 H68 L64 10 H20 Z" fill="#fff" opacity="0.55" />
          <path d="M8 34 L18 6" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" />
          <rect x="24" y="14" width="36" height="16" rx="2" fill="none" stroke="#6b7a8e" strokeOpacity="0.7" strokeWidth="0.8" />
          <text x="42" y="26" textAnchor="middle" fontFamily="Rajdhani, sans-serif" fontWeight="700" fontSize="10" fill="#3b4656" letterSpacing="1">999.9 Ag</text>
        </g>

        {/* cast copper bar (front right) */}
        <g transform="translate(148 150)">
          <ellipse cx="36" cy="42" rx="38" ry="6" fill="#000" opacity="0.45" filter="url(#softShadow)" />
          <path d="M2 30 L12 6 H60 L70 30 Z" fill="url(#copperTop)" filter="url(#metalTex)" />
          <path d="M2 30 H70 L66 42 H6 Z" fill="url(#copperSide)" />
          <path d="M12 6 H60 L57 11 H15 Z" fill="#ffd9bf" opacity="0.45" />
          <text x="36" y="25" textAnchor="middle" fontFamily="Rajdhani, sans-serif" fontWeight="700" fontSize="10" fill="#4a2109" letterSpacing="1">Cu 99.9</text>
        </g>

        {/* gold nuggets (front) */}
        <g>
          <ellipse cx="100" cy="196" rx="52" ry="7" fill="#000" opacity="0.45" filter="url(#softShadow)" />
          <path d="M60 178 l12-20 22-6 18 10 4 20 -16 10 -26 -2z" fill="url(#goldA)" stroke="#6b4408" strokeWidth="0.8" />
          <path d="M72 158 l22-6 6 12 -16 8z" fill="url(#goldFacet)" opacity="0.8" />
          <path d="M94 164 l10-14 20-2 12 12 -2 16 -16 8 -20 -6z" fill="url(#goldA)" stroke="#6b4408" strokeWidth="0.8" />
          <path d="M104 150 l20-2 2 10 -14 4z" fill="url(#goldFacet)" opacity="0.8" />
          <path d="M122 152 l8-10 14 0 8 10 -4 12 -14 4 -12 -6z" fill="url(#goldA)" stroke="#6b4408" strokeWidth="0.8" />
          <path d="M130 142 l14 0 2 6 -10 2z" fill="url(#goldFacet)" opacity="0.8" />
          {/* specular */}
          <path d="M74 172 l6-8" stroke="#fff" strokeWidth="2" strokeOpacity="0.85" strokeLinecap="round" />
          <path d="M106 160 l5-6" stroke="#fff" strokeWidth="2" strokeOpacity="0.85" strokeLinecap="round" />
          <path d="M130 148 l4-4" stroke="#fff" strokeWidth="1.6" strokeOpacity="0.85" strokeLinecap="round" />
          <circle cx="86" cy="168" r="6" fill="#fff" opacity="0.12" filter="url(#glow)" />
        </g>

        {/* loose ore chunks */}
        <path d="M40 192 l6-8 8 4 -2 8z M196 190 l6-6 6 6 -4 6z M150 196 l4-6 8 2 -2 6z M60 198 l4-5 6 2 -1 5z" fill="#2a3442" stroke="#0e1218" strokeWidth="0.6" />
        <path d="M40 192 l6-8 M196 190 l6-6" stroke="#6b788a" strokeWidth="0.8" strokeOpacity="0.7" />
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
