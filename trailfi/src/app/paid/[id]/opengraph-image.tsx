import { ImageResponse } from "next/og";
import { OG_LOGO, OG_SIZE, ogAssets } from "@/lib/og";
import { getSharePayout } from "@/lib/services/notices";

export const alt = "Paid in ETH on Strydo";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, { eth, fonts }] = await Promise.all([getSharePayout(id), ogAssets()]);
  const amount = p ? `+$${Number(p.usdAmount).toFixed(2)}` : "+ETH";
  const steps = p ? `for ${p.steps.toLocaleString("en-US")} verified steps` : "for walking";

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
          background: "#05070b",
          backgroundImage: "radial-gradient(circle at 85% 0%, rgba(47,123,255,0.28), transparent 55%)",
          fontFamily: "Space Grotesk",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <img src={OG_LOGO} width={64} height={64} />
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
            Stry<span style={{ color: "#4d94ff" }}>do</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 500, color: "rgba(255,255,255,0.6)", letterSpacing: 4, textTransform: "uppercase" }}>
            I got paid
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 6 }}>
            <div style={{ display: "flex", fontSize: 168, fontWeight: 700, lineHeight: 1, letterSpacing: -6, color: "#4d94ff" }}>{amount}</div>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img src={eth} width={92} height={92} />
            <div style={{ display: "flex", fontSize: 54, fontWeight: 700, color: "#ffffff" }}>ETH</div>
          </div>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 500, color: "rgba(255,255,255,0.7)", marginTop: 14 }}>{steps}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, fontWeight: 500, color: "rgba(255,255,255,0.75)" }}>
            Walk. Upload. Earn
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img src={eth} width={34} height={34} />
            ETH
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 26px",
              borderRadius: 999,
              border: "2px solid rgba(77,148,255,0.45)",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            <div style={{ display: "flex", width: 12, height: 12, borderRadius: 999, background: "#2f7bff" }} />
            strydo.xyz
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
