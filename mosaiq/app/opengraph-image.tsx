import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = `${site.name} · ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const corner = "M0 0H26A26 26 0 0 1 0 26Z";
const half = "M26 0A24 24 0 0 1 74 0Z";

function Mark({ px }: { px: number }) {
  return (
    <svg width={px} height={px} viewBox="-24 -24 148 148">
      {[0, 90, 180, 270].map((r) => (
        <g key={r} transform={`rotate(${r} 50 50)`} fill="#FAFAFA">
          <path d={corner} />
          <path d={half} />
        </g>
      ))}
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
          background: "radial-gradient(700px 420px at 78% 50%, rgba(255,255,255,0.08), transparent 70%), #0a0a0a",
          color: "#FAFAFA",
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
            <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -4, lineHeight: 1, color: "#9a9a9a" }}>Your pick.</div>
          </div>
          <div style={{ fontSize: 26, color: "#8c8c8c", marginTop: 44 }}>padpicker.xyz · People draft, agents launch</div>
        </div>
        <Mark px={330} />
      </div>
    ),
    size,
  );
}
