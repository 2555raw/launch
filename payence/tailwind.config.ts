import type { Config } from "tailwindcss";

/**
 * Payence's palette lives here and nowhere else. Every component pulls from these
 * tokens, so the whole identity is one file away from being re-pitched.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F4F1EA",   // warm paper, the page ground
        shell: "#E8E3D8",    // the second surface: alternating bands, insets
        ink: "#151515",      // near-black, used at full strength on purpose
        muted: "#66645F",    // secondary text, warm grey so it sits on the paper
        coral: "#FF5C35",    // primary accent: money moving, the one loud colour
        violet: "#6C63FF",   // secondary accent: policy, rules, machine decisions
        positive: "#28A96B", // approved / healthy
        danger: "#E5484D",   // frozen / stopped — a state, never the accent
      },
      borderColor: {
        hair: "rgba(21,21,21,0.12)",
        hairStrong: "rgba(21,21,21,0.22)",
        hairDark: "rgba(244,241,234,0.14)",
      },
      fontFamily: {
        sans: ["Archivo", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        // one editorial scale, used everywhere; nothing off-scale
        label: ["0.6875rem", { lineHeight: "1", letterSpacing: "0.16em" }],
        mega: ["clamp(3rem, 9vw, 8.5rem)", { lineHeight: "0.92", letterSpacing: "-0.045em" }],
        display: ["clamp(2.5rem, 6vw, 5.25rem)", { lineHeight: "0.96", letterSpacing: "-0.04em" }],
        title: ["clamp(1.75rem, 3.2vw, 3rem)", { lineHeight: "1.04", letterSpacing: "-0.035em" }],
      },
      maxWidth: { shell: "1360px" },
      borderRadius: { card: "14px", pill: "999px" },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.45", transform: "scale(0.82)" },
        },
      },
      animation: { pulseDot: "pulseDot 2.4s ease-in-out infinite" },
    },
  },
  plugins: [],
};

export default config;
