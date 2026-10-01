import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: { DEFAULT: "1rem", sm: "1.5rem", lg: "2rem" }, screens: { "2xl": "1280px" } },
    extend: {
      colors: {
        ink: {
          950: "#060807",
          900: "#0a0d0b",
          850: "#0e1210",
          800: "#131815",
          700: "#1b221e",
          600: "#27302b",
          500: "#3a453f",
        },
        forest: {
          950: "#04120c",
          900: "#071d14",
          800: "#0b2a1d",
          700: "#103a28",
          600: "#175236",
          500: "#1f6b45",
        },
        lime: {
          300: "#d8ff9c",
          400: "#c4fb6d",
          500: "#b2f047",
          600: "#8fcb24",
        },
        neon: "#5dff9d",
        mist: "#a7b5ad",
      },
      fontFamily: {
        display: ['"Space Grotesk Variable"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ['"Inter Variable"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glass: "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 20px 60px -20px rgba(0,0,0,0.6)",
        glow: "0 0 0 1px rgba(196,251,109,0.35), 0 8px 40px -8px rgba(178,240,71,0.45)",
        neon: "0 0 24px rgba(93,255,157,0.35)",
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
      },
      keyframes: {
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
        pulseDot: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.35" } },
        shimmer: { from: { backgroundPosition: "200% 0" }, to: { backgroundPosition: "-200% 0" } },
      },
      animation: {
        marquee: "marquee 40s linear infinite",
        float: "float 6s ease-in-out infinite",
        "pulse-dot": "pulseDot 1.6s ease-in-out infinite",
        shimmer: "shimmer 2.2s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
