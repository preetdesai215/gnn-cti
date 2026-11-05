/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 950: "#050b18", 900: "#0a1428", 800: "#101d36", 700: "#18294a" },
        neon: { green: "#39ff88", cyan: "#22d3ee", blue: "#3b82f6" },
        sev: { critical: "#ff4d6d", high: "#ff9f1c", medium: "#facc15", low: "#39ff88" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
