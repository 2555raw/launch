import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getShareEntry } from "@/lib/services/steps";

export const alt = "Steps walked on Stepit";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const fontDir = path.join(process.cwd(), "node_modules", "@fontsource", "space-grotesk", "files");
const LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x=".5" y=".5" width="31" height="31" rx="9.5" fill="#071d14" stroke="#c4fb6d" stroke-opacity=".35"/><g fill="#c4fb6d" opacity=".7"><ellipse cx="11" cy="20.3" rx="2.9" ry="4.3" transform="rotate(-12 11 20.3)"/><circle cx="9.1" cy="14.2" r="1.05"/><circle cx="11.1" cy="13.5" r="1.15"/><circle cx="13" cy="14.1" r=".95"/></g><g fill="#5dff9d"><ellipse cx="20.8" cy="14.6" rx="2.9" ry="4.3" transform="rotate(12 20.8 14.6)"/><circle cx="19.3" cy="8.5" r="1.05"/><circle cx="21.3" cy="7.9" r="1.15"/><circle cx="23.2" cy="8.6" r=".95"/></g></svg>`,
)}`;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [entry, bold, medium, usdg] = await Promise.all([
    getShareEntry(id),
    readFile(path.join(fontDir, "space-grotesk-latin-700-normal.woff")),
    readFile(path.join(fontDir, "space-grotesk-latin-500-normal.woff")),
    readFile(path.join(process.cwd(), "public", "tokens", "usdg.png")),
  ]);
  const steps = entry ? entry.steps.toLocaleString("en-US") : "Every step";
  const day = entry
    ? new Date(`${entry.day}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })
    : "counts";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "#060807",
          backgroundImage: "radial-gradient(circle at 85% 0%, rgba(178,240,71,0.28), transparent 55%)",
          fontFamily: "Space Grotesk",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <img src={LOGO} width={64} height={64} />
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
            Step<span style={{ color: "#c4fb6d" }}>it</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 500, color: "rgba(255,255,255,0.6)", letterSpacing: 4, textTransform: "uppercase" }}>
            I walked
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginTop: 6 }}>
            <div style={{ display: "flex", fontSize: 168, fontWeight: 700, lineHeight: 1, letterSpacing: -6, color: "#c4fb6d" }}>{steps}</div>
            <div style={{ display: "flex", fontSize: 54, fontWeight: 700, color: "#ffffff" }}>steps</div>
          </div>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 500, color: "rgba(255,255,255,0.7)", marginTop: 14 }}>on {day}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, fontWeight: 500, color: "rgba(255,255,255,0.75)" }}>
            Walk. Upload. Earn
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img src={`data:image/png;base64,${usdg.toString("base64")}`} width={34} height={34} />
            USDG
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 26px",
              borderRadius: 999,
              border: "2px solid rgba(196,251,109,0.45)",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            <div style={{ display: "flex", width: 12, height: 12, borderRadius: 999, background: "#5dff9d" }} />
            stepit.site
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Space Grotesk", data: bold, weight: 700, style: "normal" },
        { name: "Space Grotesk", data: medium, weight: 500, style: "normal" },
      ],
    },
  );
}
