/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
                // Canvas & surfaces
        ink: "#09090b",        // page canvas
        panel: "#121215",      // primary panel
        panelHi: "#18181b",    // elevated panel
        panelDark: "#0c0c0e",  // deep panel
        cardBg: "#121215",     // alias
        borderDark: "#27272a", // hairline

        // Signature accent — used for suppression / signal-through-noise / primary CTAs
        signal: "#A3E635",
        signalSoft: "#DFF7A6",
        signalDim: "#5F8F1F",

        // Data-viz semantic colors
        raw: "#38BDF8",     // raw event volume (cyan)
        alert: "#F59E0B",   // outbound notifications (amber)
        danger: "#F43F5E",  // critical severities (rose)

        // Legacy aliases kept for compatibility with existing code
        activePill: "#18181b",
        neonCyan: "#38BDF8",
        neonBlue: "#5B63D3",
        neonGreen: "#A3E635", // aliased to signal so existing text-neonGreen adopts lime
        neonYellow: "#F59E0B",
        neonRed: "#F43F5E",
        brandIndigo: "#7C87F7",
        textMuted: "#a1a1aa",
        textDark: "#71717a",
      },
      fontFamily: {
        sans: ["Inter", "Helvetica Now Text", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "ui-monospace", "monospace"],
      },
      boxShadow: {
        signal: "0 0 0 1px rgba(163, 230, 53, 0.35), 0 12px 40px -12px rgba(163, 230, 53, 0.25)",
        panel: "0 1px 0 rgba(255,255,255,0.02) inset, 0 20px 50px -20px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};
