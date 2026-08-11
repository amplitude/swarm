import type { Config } from "tailwindcss";

/**
 * SWARM Tailwind Configuration
 *
 * ALL color values are defined in src/styles/theme.css and referenced here
 * via CSS variables in HSL channel format. This file is pure wiring —
 * edit theme.css to restyle the app.
 *
 * HSL channel format (H S% L%) supports Tailwind opacity modifiers:
 *   bg-brand-500/50 → hsl(var(--brand-500) / 0.5)
 */

const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // ── Colors (all values via CSS variables from theme.css) ──────────
      colors: {
        // Overlay backdrop (modal / drawer scrim)
        overlay: {
          backdrop: `hsl(var(--overlay) / 0.5)`,
          DEFAULT:   `hsl(var(--overlay))`,
        },

        // Brand / accent scale
        // Brand / accent scale
        primary: {
          50:  `hsl(var(--brand-50)  / <alpha-value>)`,
          100: `hsl(var(--brand-100) / <alpha-value>)`,
          200: `hsl(var(--brand-200) / <alpha-value>)`,
          300: `hsl(var(--brand-300) / <alpha-value>)`,
          400: `hsl(var(--brand-400) / <alpha-value>)`,
          500: `hsl(var(--brand-500) / <alpha-value>)`,
          600: `hsl(var(--brand-600) / <alpha-value>)`,
          700: `hsl(var(--brand-700) / <alpha-value>)`,
          800: `hsl(var(--brand-800) / <alpha-value>)`,
          900: `hsl(var(--brand-900) / <alpha-value>)`,
          950: `hsl(var(--brand-950) / <alpha-value>)`,
        },

        // Canvas / surfaces / overlays
        surface: {
          DEFAULT: `hsl(var(--surface))`,
          raised:  `hsl(var(--surface-raised))`,
          overlay: `hsl(var(--surface-overlay))`,
          inset:   `hsl(var(--surface-inset))`,
        },

        // Borders
        border: {
          DEFAULT: `hsl(var(--border-default))`,
          subtle:  `hsl(var(--border-subtle))`,
          strong:  `hsl(var(--border-strong))`,
        },

        // Text
        text: {
          primary:   `hsl(var(--text-primary))`,
          secondary: `hsl(var(--text-secondary))`,
          tertiary:  `hsl(var(--text-tertiary))`,
          inverse:   `hsl(var(--text-inverse))`,
          disabled:  `hsl(var(--text-disabled))`,
        },

        // Focus ring
        ring: {
          DEFAULT: `hsl(var(--focus-ring))`,
          offset:  `hsl(var(--focus-offset))`,
        },

        // Status colors (via CSS variables)
        success: {
          50:  `hsl(var(--success-50)  / <alpha-value>)`,
          200: `hsl(var(--success-200) / <alpha-value>)`,
          300: `hsl(var(--success-300) / <alpha-value>)`,
          400: `hsl(var(--success-400) / <alpha-value>)`,
          500: `hsl(var(--success-500) / <alpha-value>)`,
          600: `hsl(var(--success-600) / <alpha-value>)`,
          900: `hsl(var(--success-900) / <alpha-value>)`,
        },
        warning: {
          50:  `hsl(var(--warning-50)  / <alpha-value>)`,
          200: `hsl(var(--warning-200) / <alpha-value>)`,
          300: `hsl(var(--warning-300) / <alpha-value>)`,
          400: `hsl(var(--warning-400) / <alpha-value>)`,
          500: `hsl(var(--warning-500) / <alpha-value>)`,
          600: `hsl(var(--warning-600) / <alpha-value>)`,
          900: `hsl(var(--warning-900) / <alpha-value>)`,
        },
        danger: {
          50:  `hsl(var(--danger-50)  / <alpha-value>)`,
          200: `hsl(var(--danger-200) / <alpha-value>)`,
          300: `hsl(var(--danger-300) / <alpha-value>)`,
          400: `hsl(var(--danger-400) / <alpha-value>)`,
          500: `hsl(var(--danger-500) / <alpha-value>)`,
          600: `hsl(var(--danger-600) / <alpha-value>)`,
          900: `hsl(var(--danger-900) / <alpha-value>)`,
        },
        info: {
          50:  `hsl(var(--info-50)  / <alpha-value>)`,
          200: `hsl(var(--info-200) / <alpha-value>)`,
          300: `hsl(var(--info-300) / <alpha-value>)`,
          400: `hsl(var(--info-400) / <alpha-value>)`,
          500: `hsl(var(--info-500) / <alpha-value>)`,
          600: `hsl(var(--info-600) / <alpha-value>)`,
          900: `hsl(var(--info-900) / <alpha-value>)`,
        },

        // Agent accent colors
        agent: {
          coder:    `hsl(var(--agent-coder))`,
          pm:       `hsl(var(--agent-pm))`,
          designer: `hsl(var(--agent-designer))`,
          general:  `hsl(var(--agent-general))`,
        },

        // Gray/neutral scale
        gray: {
          50:  `hsl(var(--gray-50)  / <alpha-value>)`,
          100: `hsl(var(--gray-100) / <alpha-value>)`,
          200: `hsl(var(--gray-200) / <alpha-value>)`,
          300: `hsl(var(--gray-300) / <alpha-value>)`,
          400: `hsl(var(--gray-400) / <alpha-value>)`,
          500: `hsl(var(--gray-500) / <alpha-value>)`,
          600: `hsl(var(--gray-600) / <alpha-value>)`,
          700: `hsl(var(--gray-700) / <alpha-value>)`,
          800: `hsl(var(--gray-800) / <alpha-value>)`,
          850: `hsl(var(--gray-850) / <alpha-value>)`,
          900: `hsl(var(--gray-900) / <alpha-value>)`,
          950: `hsl(var(--gray-950) / <alpha-value>)`,
        },
      },

      // ── Typography ──────────────────────────────────────────────
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont",
               "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "SF Mono", "Consolas", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem",  { lineHeight: "0.875rem" }],
        xs:    ["0.75rem",   { lineHeight: "1rem" }],
        sm:    ["0.8125rem", { lineHeight: "1.25rem" }],
        base:  ["0.875rem",  { lineHeight: "1.375rem" }],
        md:    ["0.9375rem", { lineHeight: "1.5rem" }],
        lg:    ["1rem",      { lineHeight: "1.5rem" }],
        xl:    ["1.125rem",  { lineHeight: "1.75rem" }],
        "2xl": ["1.25rem",   { lineHeight: "1.75rem" }],
        "3xl": ["1.5rem",    { lineHeight: "2rem" }],
        "4xl": ["1.875rem",  { lineHeight: "2.25rem" }],
      },
      letterSpacing: {
        tighter: "-0.03em",
        tight:   "-0.02em",
        normal:  "-0.01em",
        wide:    "0.01em",
      },

      // ── Spacing / Layout ─────────────────────────────────────────
      spacing: {
        sidebar:     "var(--sidebar-width)",      /* 240px */
        panel:       "var(--inspector-width)",     /* 400px */
        "panel-sm":  "var(--inspector-width-sm)",  /* 320px */
        "panel-lg":  "var(--inspector-width-lg)",  /* 560px */
        "card-agent":"17.5rem",
        "feed-h":    "12.5rem",
      },

      // ── Max Width (content areas) ────────────────────────────────
      maxWidth: {
        content: "var(--content-max-width)",   /* 768px */
        panel:   "var(--panel-max-width)",     /* 672px */
      },

      // ── Border Radius ────────────────────────────────────────────
      borderRadius: {
        none:  "0",
        sm:    "var(--radius-sm)",
        DEFAULT:"var(--radius-md)",
        md:    "var(--radius-lg)",
        lg:    "var(--radius-xl)",
        xl:    "var(--radius-2xl)",
        "2xl": "var(--radius-3xl)",
        full:  "var(--radius-full)",
      },

      // ── Shadows ──────────────────────────────────────────────────
      boxShadow: {
        "xs":           "var(--shadow-xs)",
        "sm":           "var(--shadow-sm)",
        "DEFAULT":      "var(--shadow-md)",
        "md":           "var(--shadow-lg)",
        "lg":           "var(--shadow-xl)",
        "xl":           "var(--shadow-2xl)",
        "inner":        "var(--shadow-inner)",
        "glow-primary": "var(--shadow-glow-brand)",
        "glow-coder":   "var(--shadow-glow-coder)",
        "glow-pm":      "var(--shadow-glow-pm)",
        "glow-designer":"var(--shadow-glow-designer)",
        "glow-general": "var(--shadow-glow-general)",
      },

      // ── Animations ───────────────────────────────────────────────
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(8px)" },
          to:   { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-8px)" },
          to:   { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.4" },
        },
        "thinking": {
          "0%":   { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to:   { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-in":         "fade-in 150ms ease-out",
        "fade-up":         "fade-up 200ms ease-out",
        "slide-in-right":  "slide-in-right 200ms ease-out",
        "slide-in-left":   "slide-in-left 200ms ease-out",
        "scale-in":        "scale-in 150ms ease-out",
        "pulse-dot":       "pulse-dot 1.5s ease-in-out infinite",
        "thinking":        "thinking 2s linear infinite",
        "spin-slow":       "spin-slow 3s linear infinite",
      },

      // ── Z-Index Scale ────────────────────────────────────────────
      zIndex: {
        sidebar: "30",
        header:  "40",
        panel:   "20",
        overlay: "50",
        modal:   "60",
        toast:   "70",
        tooltip: "80",
      },

      // ── Transitions ──────────────────────────────────────────────
      transitionDuration: {
        "75":  "75ms",
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
