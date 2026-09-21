import type { Config } from "tailwindcss";

/**
 * Payence's identity in one file. Colour is assigned by role: coral is the one
 * brand accent and it marks money in motion; the state colours never double as
 * decoration. Everything else is ink on warm, near-white paper.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F6F5F1", // page ground: warm, near white
        surface: "#FFFFFF", // cards and sheets
        shell: "#ECEAE3", // insets, alternating bands, skeletons
        ink: "#141414",
        muted: "#6B6963",
        faint: "#9B9993",
        coral: { DEFAULT: "#FF5C35", soft: "#FFEDE7" },
        positive: { DEFAULT: "#1F9D5B", soft: "#E6F5EC" },
        warning: { DEFAULT: "#C97A0A", soft: "#FCF1DC" },
        danger: { DEFAULT: "#DC3D43", soft: "#FCE8E9" },
      },
      borderColor: {
        hair: "rgba(20,20,20,0.10)",
        hairStrong: "rgba(20,20,20,0.20)",
        hairDark: "rgba(246,245,241,0.14)",
      },
      fontFamily: {
        sans: ["Archivo", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        label: ["0.6875rem", { lineHeight: "1", letterSpacing: "0.12em" }],
        mega: ["clamp(2.75rem, 8vw, 7.5rem)", { lineHeight: "0.94", letterSpacing: "-0.045em" }],
        display: ["clamp(2.25rem, 5.5vw, 4.75rem)", { lineHeight: "0.98", letterSpacing: "-0.04em" }],
        title: ["clamp(1.6rem, 3vw, 2.75rem)", { lineHeight: "1.06", letterSpacing: "-0.03em" }],
        amount: ["clamp(2.25rem, 6vw, 3.25rem)", { lineHeight: "1", letterSpacing: "-0.04em" }],
      },
      maxWidth: { shell: "1280px", app: "1120px" },
      borderRadius: { card: "16px", sheet: "24px", pill: "999px" },
      boxShadow: {
        card: "0 1px 2px rgba(20,20,20,0.04), 0 8px 24px -16px rgba(20,20,20,0.18)",
        float: "0 24px 48px -24px rgba(20,20,20,0.35)",
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.45", transform: "scale(0.82)" },
        },
        shimmer: { "0%": { backgroundPosition: "200% 0" }, "100%": { backgroundPosition: "-200% 0" } },
        rise: { from: { opacity: "0", transform: "translateY(10px)" }, to: { opacity: "1", transform: "none" } },
        pop: { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "none" } },
        spin: { to: { transform: "rotate(360deg)" } },
      },
      animation: {
        pulseDot: "pulseDot 2.4s ease-in-out infinite",
        shimmer: "shimmer 1.6s linear infinite",
        rise: "rise 0.4s cubic-bezier(0.22,0.65,0.3,1) both",
        pop: "pop 0.32s cubic-bezier(0.22,0.65,0.3,1) both",
        spin: "spin 0.8s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
