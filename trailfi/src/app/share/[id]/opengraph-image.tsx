import { ImageResponse } from "next/og";
import { OG_LOGO, OG_SIZE, ogAssets } from "@/lib/og";
import { getShareEntry } from "@/lib/services/steps";

export const alt = "Steps walked on Stepit";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [entry, { usdg, fonts }] = await Promise.all([getShareEntry(id), ogAssets()]);
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
          <img src={OG_LOGO} width={64} height={64} />
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
            <img src={usdg} width={34} height={34} />
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
      fonts,
    },
  );
}
