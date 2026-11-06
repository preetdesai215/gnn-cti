/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Console palette: near-black surfaces with a cool tint, one red accent
        navy: { 950: "#05070a", 900: "#0b0e13", 800: "#11151c", 700: "#1a1f28" },
        accent: { DEFAULT: "#e11d2e", light: "#ff4d5e", dark: "#7f1d1d" },
        sev: { critical: "#ff4d6d", high: "#ff9f1c", medium: "#facc15", low: "#34d399" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
