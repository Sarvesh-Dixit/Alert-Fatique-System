/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B0C14",        // Better Stack Canvas
        panel: "#0F101A",      // Panel Base
        panelDark: "#171926",  // Panel Dark
        cardBg: "#161928",     // Card Base
        borderDark: "#252940", // Card Stroke
        activePill: "#23273b", // Active Hover
        neonCyan: "#38BDF8",   // Brand Cyan
        neonBlue: "#5B63D3",   // Brand Blue
        neonGreen: "#10b981",  // Emerald Green
        neonYellow: "#f59e0b", // Amber/Yellow
        neonRed: "#f43f5e",    // Crimson Red
        brandIndigo: "#7C87F7", // Indigo Accent
        textMuted: "#C9D3EE",
        textDark: "#646E87",
      },
      fontFamily: {
        sans: ["Inter", "Helvetica Now Text", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
