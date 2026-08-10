import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // ── Color Palette ──────────────────────────────────────────────
      colors: {
        // Neutrals (dark-first design, Linear-inspired)
        gray: {
          50: "#f7f7f8",
          100: "#ebebef",
          200: "#d4d4dc",
          300: "#b0b0be",
          400: "#8b8b9e",
          500: "#6e6e82",
          600: "#55556a",
          700: "#3d3d55",
          800: "#2a2a3c",
          850: "#222234",
          900: "#1a1a2e",
          950: "#12121f",
        },
        // Primary brand — cool indigo-violet
        primary: {
          50: "#eef2ff",
          100: "#dbe4ff",
          200: "#bfcfff",
          300: "#93aeff",
          400: "#6b8afc",
          500: "#5570f7",
          600: "#4050eb",
          700: "#3340d8",
          800: "#2b35ae",
          900: "#283089",
          950: "#1a1e54",
        },
        // Surface colors for cards, panels, inputs
        surface: {
          DEFAULT: "var(--surface)",
          raised: "var(--surface-raised)",
          overlay: "var(--surface-overlay)",
          inset: "var(--surface-inset)",
        },
        // Border
        border: {
          DEFAULT: "var(--border)",
          subtle: "var(--border-subtle)",
          strong: "var(--border-strong)",
        },
        // Text
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
          inverse: "var(--text-inverse)",
        },
        // Semantic colors
        success: {
          50: "#ecfdf5",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          900: "#064e3b",
        },
        warning: {
          50: "#fffbeb",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          900: "#78350f",
        },
        danger: {
          50: "#fef2f2",
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
          900: "#7f1d1d",
        },
        info: {
          50: "#eff6ff",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          900: "#1e3a8a",
        },
        // ── Agent Accent Colors ────────────────────────────────────
        agent: {
          coder: {
            DEFAULT: "#22d3ee", // cyan-400 — technical, precise
            muted: "#164e63",  // cyan-900 — dark bg badge
            light: "#ecfeff",  // cyan-50 — light mode bg
          },
          pm: {
            DEFAULT: "#a78bfa", // violet-400 — organized, strategic
            muted: "#3b0764",  // violet-950 — dark bg badge
            light: "#f5f3ff",  // violet-50 — light mode bg
          },
          designer: {
            DEFAULT: "#fb923c", // orange-400 — creative, visual
            muted: "#7c2d12",  // orange-900 — dark bg badge
            light: "#fff7ed",  // orange-50 — light mode bg
          },
          general: {
            DEFAULT: "#4ade80", // green-400 — approachable, versatile
            muted: "#14532d",  // green-900 — dark bg badge
            light: "#f0fdf4",  // green-50 — light mode bg
          },
        },
      },

      // ── Typography ────────────────────────────────────────────────
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "SF Mono",
          "Consolas",
          "monospace",
        ],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],   // 10px
        xs: ["0.75rem", { lineHeight: "1rem" }],            // 12px
        sm: ["0.8125rem", { lineHeight: "1.25rem" }],       // 13px
        base: ["0.875rem", { lineHeight: "1.375rem" }],     // 14px (default)
        md: ["0.9375rem", { lineHeight: "1.5rem" }],        // 15px
        lg: ["1rem", { lineHeight: "1.5rem" }],             // 16px
        xl: ["1.125rem", { lineHeight: "1.75rem" }],        // 18px
        "2xl": ["1.25rem", { lineHeight: "1.75rem" }],      // 20px
        "3xl": ["1.5rem", { lineHeight: "2rem" }],          // 24px
        "4xl": ["1.875rem", { lineHeight: "2.25rem" }],     // 30px
      },
      letterSpacing: {
        tighter: "-0.03em",
        tight: "-0.02em",
        normal: "-0.01em",
        wide: "0.01em",
      },

      // ── Spacing ───────────────────────────────────────────────────
      spacing: {
        "0.5": "0.125rem",   // 2px
        "1": "0.25rem",      // 4px
        "1.5": "0.375rem",   // 6px
        "2": "0.5rem",       // 8px
        "2.5": "0.625rem",   // 10px
        "3": "0.75rem",      // 12px
        "3.5": "0.875rem",   // 14px
        "4": "1rem",         // 16px
        "5": "1.25rem",      // 20px
        "6": "1.5rem",       // 24px
        "8": "2rem",         // 32px
        "10": "2.5rem",      // 40px
        "12": "3rem",        // 48px
        "16": "4rem",        // 64px
        "20": "5rem",        // 80px
        "sidebar": "15rem",      // 240px — sidebar width
        "panel": "25rem",        // 400px — right panel width
        "panel-sm": "20rem",     // 320px — collapsed panel
        "panel-lg": "35rem",     // 560px — expanded detail panel
        "card-agent": "17.5rem", // 280px — min agent card width
        "feed-h": "12.5rem",    // 200px — activity feed height
      },

      // ── Border Radius ─────────────────────────────────────────────
      borderRadius: {
        none: "0",
        sm: "0.25rem",       // 4px — subtle rounding
        DEFAULT: "0.375rem", // 6px — default for inputs, cards
        md: "0.5rem",        // 8px — medium elements
        lg: "0.75rem",       // 12px — larger cards, modals
        xl: "1rem",          // 16px — prominent elements
        "2xl": "1.25rem",    // 20px — feature cards
        full: "9999px",      // pill shapes, avatars
      },

      // ── Shadows ───────────────────────────────────────────────────
      boxShadow: {
        "xs": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "sm": "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        "DEFAULT": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
        "md": "0 4px 8px -2px rgb(0 0 0 / 0.15), 0 2px 4px -2px rgb(0 0 0 / 0.08)",
        "lg": "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
        "xl": "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
        "inner": "inset 0 2px 4px 0 rgb(0 0 0 / 0.06)",
        // Dark-mode optimized glow shadows
        "glow-primary": "0 0 20px rgb(85 112 247 / 0.15)",
        "glow-coder": "0 0 20px rgb(34 211 238 / 0.15)",
        "glow-pm": "0 0 20px rgb(167 139 250 / 0.15)",
        "glow-designer": "0 0 20px rgb(251 146 60 / 0.15)",
        "glow-general": "0 0 20px rgb(74 222 128 / 0.15)",
      },

      // ── Animations ────────────────────────────────────────────────
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(8px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-8px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        "thinking": {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "fade-up": "fade-up 200ms ease-out",
        "slide-in-right": "slide-in-right 200ms ease-out",
        "slide-in-left": "slide-in-left 200ms ease-out",
        "scale-in": "scale-in 150ms ease-out",
        "pulse-dot": "pulse-dot 1.5s ease-in-out infinite",
        "thinking": "thinking 2s linear infinite",
        "spin-slow": "spin-slow 3s linear infinite",
      },

      // ── Z-Index Scale ─────────────────────────────────────────────
      zIndex: {
        "sidebar": "30",
        "header": "40",
        "panel": "20",
        "overlay": "50",
        "modal": "60",
        "toast": "70",
        "tooltip": "80",
      },

      // ── Transitions ───────────────────────────────────────────────
      transitionDuration: {
        "75": "75ms",
        "100": "100ms",
        "150": "150ms",
        "200": "200ms",
        "250": "250ms",
        "300": "300ms",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
  ],
};

export default config;
