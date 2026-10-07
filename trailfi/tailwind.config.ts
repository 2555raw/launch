import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: { DEFAULT: "1rem", sm: "1.5rem", lg: "2rem" }, screens: { "2xl": "1280px" } },
    extend: {
      colors: {
        ink: {
          950: "#05070b",
          900: "#090c12",
          850: "#0d1118",
          800: "#121722",
          700: "#1a2130",
          600: "#262f40",
          500: "#384357",
        },
        forest: {
          950: "#040a16",
          900: "#071226",
          800: "#0b1b36",
          700: "#102648",
          600: "#17345f",
          500: "#1f4578",
        },
        // The brand accent. Kept under the name "lime" so every existing class picks it up: Strydo's electric blue.
        lime: {
          50: "#eef5ff",
          100: "#dbe9ff",
          200: "#bdd6ff",
          300: "#9cc2ff",
          400: "#4d94ff",
          500: "#2f7bff",
          600: "#1f63e0",
          700: "#1b4fb3",
          800: "#1b428c",
          900: "#1b386f",
          950: "#121f3d",
        },
        neon: "#2f7bff",
        mist: "#a5b0c2",
      },
      fontFamily: {
        display: ['"Space Grotesk Variable"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ['"Inter Variable"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glass: "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 20px 60px -20px rgba(0,0,0,0.6)",
        glow: "0 0 0 1px rgba(77,148,255,0.35), 0 8px 40px -8px rgba(47,123,255,0.45)",
        neon: "0 0 24px rgba(47,123,255,0.35)",
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
