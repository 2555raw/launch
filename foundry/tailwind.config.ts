import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07090d",
          900: "#0c1017",
          800: "#121823",
          700: "#1a2231",
          600: "#232e40",
          500: "#2f3d53",
        },
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          soft: "rgb(var(--brand-soft) / <alpha-value>)",
          deep: "rgb(var(--brand-deep) / <alpha-value>)",
        },
        ember: "#ff6a1f",
        burn: "#ff3b3b",
      },
      fontFamily: {
        display: ["'Rajdhani'", "'Segoe UI'", "system-ui", "sans-serif"],
        body: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "0 0 0 1px rgba(255,255,255,0.04), 0 20px 50px -20px rgba(0,0,0,0.8)",
        glow: "0 0 60px rgb(var(--brand) / 0.35)",
      },
      keyframes: {
        floatUp: {
          "0%": { transform: "translate(-50%, 0) scale(1)", opacity: "1" },
          "100%": { transform: "translate(-50%, -120px) scale(1.25)", opacity: "0" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        spinSlow: { to: { transform: "rotate(360deg)" } },
        ticker: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
        toastIn: {
          "0%": { transform: "translateY(16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        floatUp: "floatUp 1s ease-out forwards",
        pulseGlow: "pulseGlow 3s ease-in-out infinite",
        spinSlow: "spinSlow 40s linear infinite",
        ticker: "ticker 40s linear infinite",
        toastIn: "toastIn 0.3s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
