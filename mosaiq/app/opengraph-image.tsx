import { ImageResponse } from "next/og";
import { LOGO_PATHS, LOGO_TRANSFORM, LOGO_VIEWBOX } from "@/lib/logo-paths";
import { site } from "@/lib/site";

export const alt = `${site.name} · ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function Mark({ px }: { px: number }) {
  return (
    <svg width={px} height={px} viewBox={LOGO_VIEWBOX}>
      <defs>
        <linearGradient id="og-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#60A5FA" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      <g transform={LOGO_TRANSFORM} fill="url(#og-mark)">
        {LOGO_PATHS.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: "radial-gradient(700px 420px at 78% 50%, rgba(59,130,246,0.22), transparent 70%), radial-gradient(500px 300px at 10% 0%, rgba(14,165,233,0.10), transparent 70%), #1C1D21",
          color: "#F2F3F5",
          padding: 80,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 44, fontWeight: 700 }}>
            <Mark px={56} />
            {site.name}
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 44 }}>
            <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -4, lineHeight: 1 }}>Every pad.</div>
            <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -4, lineHeight: 1, color: "#60A5FA" }}>Your choice.</div>
          </div>
          <div style={{ fontSize: 26, color: "#A1A5AD", marginTop: 44 }}>One form for every launchpad · Launch from your wallet</div>
        </div>
        <Mark px={330} />
      </div>
    ),
    size,
  );
}
