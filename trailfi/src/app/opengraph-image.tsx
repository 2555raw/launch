import { ImageResponse } from "next/og";
import { OG_LOGO, OG_SIZE, ogAssets } from "@/lib/og";

/** The preview card shown when stepit.site is shared on X, Telegram, WhatsApp... */
export const alt = "Stepit. Walk, upload your steps and earn USDG.";
export const size = OG_SIZE;
export const contentType = "image/png";

const LIME = "#c4fb6d";

export default async function Image() {
  const { usdg, fonts } = await ogAssets();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 72px",
          background: "#060807",
          backgroundImage: "radial-gradient(circle at 82% 45%, rgba(196,251,109,0.16), transparent 52%)",
          fontFamily: "Space Grotesk",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between", padding: "64px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img src={OG_LOGO} width={64} height={64} />
            <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
              Step<span style={{ color: LIME }}>it</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 92, fontWeight: 700, lineHeight: 1, letterSpacing: -4 }}>Walk. Upload.</div>
            <div style={{ display: "flex", alignItems: "center", gap: 22, fontSize: 92, fontWeight: 700, lineHeight: 1.1, letterSpacing: -4, color: LIME }}>
              Earn
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <img src={usdg} width={78} height={78} />
              USDG.
            </div>
            <div style={{ display: "flex", maxWidth: 560, marginTop: 26, fontSize: 27, fontWeight: 500, lineHeight: 1.4, color: "rgba(255,255,255,0.62)" }}>
              Upload your daily steps with a screenshot and get paid on Robinhood Chain.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              alignSelf: "flex-start",
              padding: "12px 24px",
              borderRadius: 999,
              border: "2px solid rgba(196,251,109,0.45)",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            <div style={{ display: "flex", width: 11, height: 11, borderRadius: 999, background: "#5dff9d" }} />
            stepit.site
          </div>
        </div>

        {/* A day on Stepit, as the walker sees it */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 340,
            padding: 32,
            borderRadius: 36,
            border: "1.5px solid rgba(255,255,255,0.12)",
            background: "rgba(16,22,19,0.92)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 17, fontWeight: 500, letterSpacing: 3, color: "rgba(255,255,255,0.5)" }}>
            TODAY
            <div style={{ display: "flex", padding: "6px 14px", borderRadius: 999, background: "rgba(196,251,109,0.14)", color: LIME, letterSpacing: 1, fontSize: 16 }}>
              Verified
            </div>
          </div>
          <div style={{ display: "flex", marginTop: 22, fontSize: 84, fontWeight: 700, lineHeight: 1, letterSpacing: -3, color: LIME }}>8,432</div>
          <div style={{ display: "flex", marginTop: 6, fontSize: 24, fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>steps walked</div>
          <div style={{ display: "flex", marginTop: 26, height: 12, borderRadius: 999, background: "rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", width: "84%", borderRadius: 999, background: `linear-gradient(90deg, #8fd14f, ${LIME})` }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 16, color: "rgba(255,255,255,0.4)" }}>
            <span>0</span>
            <span>goal 10,000</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 28,
              padding: "14px 18px",
              borderRadius: 20,
              border: "1.5px solid rgba(196,251,109,0.25)",
              background: "rgba(196,251,109,0.06)",
              fontSize: 22,
              fontWeight: 500,
            }}
          >
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img src={usdg} width={30} height={30} />
            Paid in USDG
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
