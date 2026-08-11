# Theming Guide

Edit **one file** to restyle the entire app: `src/styles/theme.css`.

---

## How it works

All visual values (colors, radii, shadows, spacing, layout dimensions) are stored as CSS custom properties in `src/styles/theme.css`. Tailwind classes reference these variables, and components use Tailwind's semantic utility classes. There are no hardcoded color values anywhere else.

```
theme.css  ──→  CSS custom properties (HSL channels)
                   │
          ┌────────┴────────┐
          ▼                 ▼
  tailwind.config.ts    Semantic utility classes
  (wires variables)     (bg-surface, text-primary, etc.)
          │
          ▼
     Components
  (use semantic tokens only)
```

---

## Editing theme.css

### HSL channel syntax

Every color variable stores **three space-separated values**: Hue (0–360), Saturation (0–100%), Lightness (0–100%).

```css
--brand-500: 229 91% 65%;   /* a vivid indigo */
```

This format is compatible with Tailwind's opacity modifier:

```html
<div class="bg-brand-500/50">   <!-- 50% opacity -->
```

The slash-and-opacity syntax works because the Tailwind config wraps the variable with `hsl(...) / <alpha-value>`. Using HSL channels instead of raw `hsl()` strings allows Tailwind to inject its own alpha.

### File structure

| Section | Variables | What they control |
|---------|-----------|-------------------|
| 1. Brand / Accent | `--brand-*`, `--agent-*` | Primary buttons, links, agent identity colors |
| 2. Canvas / Surfaces | `--canvas`, `--surface`, `--surface-raised`, `--surface-inset`, `--overlay` | Page background, card backgrounds, modal backdrop |
| 3. Text | `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-inverse`, `--text-disabled` | All text colors |
| 4. Border / Focus | `--border-*`, `--focus-ring`, `--focus-offset` | Borders, dividers, focus outlines |
| 5. Status colors | `--success-*`, `--warning-*`, `--danger-*`, `--info-*` | Semantic feedback colors |
| 6. Typography | `--font-*`, `--text-*` | Font stacks, type scale |
| 7. Radii | `--radius-*`, `--composer-radius`, `--message-radius`, `--control-radius` | Corner rounding |
| 8. Shadows | `--shadow-*`, `--shadow-glow-*` | Elevation, agent glow effects |
| 9. Density / Spacing | `--gap-*`, `--panel-gap`, `--control-height` | Gaps, control sizing |
| 10. Layout dimensions | `--sidebar-width`, `--inspector-width`, `--content-max-width`, `--header-height` | Panel widths, max content width |
| 11. Message appearance | `--message-*`, `--handoff-*` | Bubble styling per role |

### Dark overrides

Dark mode values live under `.dark {}` in the same file. When `<html class="dark">`, those overrides take effect.

Light mode is the default (values under `:root`). Add `.light` overrides for a light color scheme.

## Example: Brand color change

To switch from indigo to rose:

```css
:root {
  --brand-50:   340 96% 97%;
  --brand-100:  340 95% 93%;
  --brand-200:  340 94% 87%;
  --brand-300:  340 93% 79%;
  --brand-400:  340 92% 70%;
  --brand-500:  340 85% 60%;   /* ← new brand primary */
  --brand-600:  340 80% 52%;
  --brand-700:  340 75% 45%;
  --brand-800:  340 70% 38%;
  --brand-900:  340 65% 30%;
  --brand-950:  340 60% 20%;
}
```

Every button, link, and accent updates automatically.

## Example: Tight density

```css
:root {
  --gap-sm:   0.25rem;    /* 4px  (default 8px) */
  --gap-md:   0.5rem;     /* 8px  (default 12px) */
  --gap-lg:   0.75rem;    /* 12px (default 16px) */
  --panel-gap: 0.5rem;    /* tighter panel spacing */
  --control-height: 1.5rem; /* shorter buttons/inputs */
  --sidebar-width: 12rem;  /* narrower sidebar */
}
```

## Example: Rounded corners

```css
:root {
  --radius-sm:  0.125rem;  /* 2px */
  --radius-md:  0.25rem;   /* 4px */
  --radius-lg:  0.375rem;  /* 6px */
  --radius-xl:  0.5rem;    /* 8px */
  --radius-2xl: 0.75rem;   /* 12px */
}
```

---

## Semantic Tailwind classes

These utility classes are available everywhere (defined in theme.css and wired in tailwind.config.ts):

| Class | Effect |
|-------|--------|
| `bg-surface` | Default card/panel background |
| `bg-surface-raised` | Elevated surface (modals, dropdowns) |
| `bg-surface-overlay` | Overlay surface |
| `bg-surface-inset` | Inset background (code blocks, inputs) |
| `text-text-primary` | Primary text color |
| `text-text-secondary` | Secondary/muted text |
| `text-text-tertiary` | Tertiary/placeholder text |
| `text-text-inverse` | Text on brand or dark backgrounds |
| `border-border` | Default border |
| `border-border-subtle` | Subtle divider |
| `border-border-strong` | Strong/hover border |
| `bg-primary-*` | Brand backgrounds (50–950) |
| `text-primary-*` | Brand text colors |
| `bg-success-*` / `bg-warning-*` / `bg-danger-*` / `bg-info-*` | Status backgrounds |
| `max-w-content` | Chat/content max width |
| `max-w-panel` | Settings/modal max width |
| `w-sidebar` | Sidebar width |
| `w-panel` | Inspector panel width |
| `shadow-glow-primary` | Brand glow shadow |
| `shadow-glow-coder` / `-pm` / `-designer` / `-general` | Agent glow shadows |

For ad-hoc usage without a Tailwind utility, CSS classes are exposed:

| Class | Effect |
|-------|--------|
| `.canvas-bg` | Deepest app background |
| `.surface-bg` | Default surface background |
| `.elevated-bg` | Elevated (modal/overlay) background |
| `.brand-bg` | Primary brand background |
| `.content-width` | Constrain to `--content-max-width` |
| `.muted-text` | Tertiary/muted text color |
| `.default-border` | Default border color |
| `.status-success` / `.status-warning` / `.status-danger` / `.status-info` | Status dot backgrounds |
| `.message-user` | User bubble styling |
| `.message-assistant` | Assistant bubble styling |
| `.control-default` | Default control height |
| `.sidebar-width` | Sidebar width value |
| `.inspector-width` | Inspector width value |

---

## No runtime theme editor

This is not a runtime theming system. `theme.css` is compiled at build time. To preview changes, edit the file and rebuild / live-reload. There is no separate token config file — `theme.css` is the single source of truth.
