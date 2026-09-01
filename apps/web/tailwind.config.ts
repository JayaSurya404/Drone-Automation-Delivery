import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          750: "#243248",
          850: "#152033",
          950: "#070b14"
        },
        cyan: {
          450: "#00d9ff",
          550: "#00a8d6"
        },
        blue: {
          950: "#081a36"
        }
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"]
      },
      boxShadow: {
        hud: "0 0 25px rgba(0, 240, 255, 0.08)",
        "hud-glow": "0 0 35px rgba(0, 240, 255, 0.2)"
      }
    }
  },
  plugins: []
};

export default config;
