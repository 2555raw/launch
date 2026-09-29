import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = `${site.name} · ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const tiles = ["#3DD9B3", "#F5C84B", "#7C9CFF", "#FF6A3D", "#C9A7FF", "#FF9F43"];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "radial-gradient(900px 500px at 85% 0%, rgba(255,106,61,0.22), transparent 70%), #07080a",
          color: "#F3EFE7",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, fontWeight: 700 }}>
            <div style={{ display: "flex", width: 40, height: 40, borderRadius: 10, background: "#FF6A3D" }} />
            {site.name}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 88, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>Every launchpad.</div>
            <div style={{ fontSize: 88, fontWeight: 700, letterSpacing: -3, lineHeight: 1, color: "#a3a6ad" }}>One canvas.</div>
          </div>
          <div style={{ fontSize: 26, color: "#a3a6ad" }}>Solana · BNB Chain · Base — you draft, your agent launches.</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", width: 300, gap: 16, alignContent: "center" }}>
          {tiles.map((c, i) => (
            <div
              key={c}
              style={{
                display: "flex",
                width: 136,
                height: 136,
                borderRadius: 28,
                background: i === 3 ? c : `${c}33`,
                border: `2px solid ${c}66`,
              }}
            />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
