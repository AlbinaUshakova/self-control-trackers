import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#03101f",
        shell: "#081320",
        panel: "#0d1829",
        panelAlt: "#101d31",
        line: "rgba(148, 163, 184, 0.14)",
        text: "#f8fafc",
        muted: "#8da0b8",
        accent: "#2DD184",
        danger: "#fb7185"
      },
      boxShadow: {
        shell: "0 30px 70px rgba(0,0,0,0.52)",
        panel: "0 14px 30px rgba(0,0,0,0.28)",
        accent: "0 6px 16px rgba(45,209,132,0.10)"
      },
      borderRadius: {
        app: "28px"
      },
      fontFamily: {
        sans: ["Inter", "SF Pro Display", "SF Pro Text", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
} satisfies Config;
