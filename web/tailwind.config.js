/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 950: "#070707", 900: "#111111", 800: "#1a1a1a", 700: "#262626" },
        accent: { DEFAULT: "#e11d2e", light: "#ff5c6c", dark: "#7f1d1d" },
        sev: { critical: "#ff4d6d", high: "#ff9f1c", medium: "#facc15", low: "#34d399" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
