# Swarm Design System

Visual language and component style guide for the Swarm agentic web app.

---

## Color Palette

### Neutrals (Dark-first)

| Token       | Hex       | Usage                               |
|-------------|-----------|-------------------------------------|
| gray-50     | `#f7f7f8` | Light mode background               |
| gray-100    | `#ebebef` | Light mode inset surfaces           |
| gray-200    | `#d4d4dc` | Light mode borders                  |
| gray-300    | `#b0b0be` | Secondary text (dark mode)          |
| gray-400    | `#8b8b9e` | Tertiary text (dark mode)           |
| gray-500    | `#6e6e82` | Muted text, placeholders            |
| gray-600    | `#55556a` | Secondary text (light mode)         |
| gray-700    | `#3d3d55` | Borders (dark mode)                 |
| gray-800    | `#2a2a3c` | Raised surfaces, overlays           |
| gray-850    | `#222234` | Raised surface default              |
| gray-900    | `#1a1a2e` | App background (dark mode)          |
| gray-950    | `#12121f` | Deepest inset surfaces              |

### Primary Brand

| Token        | Hex       | Usage                              |
|--------------|-----------|------------------------------------|
| primary-400  | `#6b8afc` | Links, accents (dark mode)         |
| primary-500  | `#5570f7` | Primary interactive elements       |
| primary-600  | `#4050eb` | Primary buttons, active states     |
| primary-700  | `#3340d8` | Pressed states                     |

### Semantic Colors

| Role    | Default   | Light BG  | Dark BG   |
|---------|-----------|-----------|-----------|
| Success | `#10b981` | `#ecfdf5` | `#064e3b` |
| Warning | `#f59e0b` | `#fffbeb` | `#78350f` |
| Danger  | `#ef4444` | `#fef2f2` | `#7f1d1d` |
| Info    | `#3b82f6` | `#eff6ff` | `#1e3a8a` |

### Agent Accent Colors

Each agent type has a unique color for identity and quick recognition.

| Agent    | Accent    | Muted BG  | Light BG  | Glow Shadow              |
|----------|-----------|-----------|-----------|--------------------------|
| Coder    | `#22d3ee` | `#164e63` | `#ecfeff` | `0 0 20px rgb(34 211 238 / 0.15)` |
| PM       | `#a78bfa` | `#3b0764` | `#f5f3ff` | `0 0 20px rgb(167 139 250 / 0.15)` |
| Designer | `#fb923c` | `#7c2d12` | `#fff7ed` | `0 0 20px rgb(251 146 60 / 0.15)` |
| General  | `#4ade80` | `#14532d` | `#f0fdf4` | `0 0 20px rgb(74 222 128 / 0.15)` |

**Usage**: Agent badges, sidebar indicators, message accents, avatar borders, glow effects on active panels.

### Dark / Light Mode

- Dark is the default. The `dark` class on `<html>` activates dark tokens.
- Light mode uses `.light` class on `<html>`.
- All surface/border/text colors are driven by CSS custom properties for seamless switching.

---

## Typography

### Font Stack

- **Sans**: Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif
- **Mono**: JetBrains Mono, Fira Code, SF Mono, Consolas, monospace

### Type Scale

| Token  | Size   | Line Height | Usage                         |
|--------|--------|-------------|-------------------------------|
| 2xs    | 10px   | 14px        | Badges, captions              |
| xs     | 12px   | 16px        | Labels, metadata              |
| sm     | 13px   | 20px        | Secondary UI text             |
| base   | 14px   | 22px        | Body text, chat messages      |
| md     | 15px   | 24px        | Emphasized body               |
| lg     | 16px   | 24px        | Section headers               |
| xl     | 18px   | 28px        | Panel titles                  |
| 2xl    | 20px   | 28px        | Page headings                 |
| 3xl    | 24px   | 32px        | Feature titles                |
| 4xl    | 30px   | 36px        | Hero text                     |

### Letter Spacing

- Headings: `-0.02em` to `-0.03em` (tight/tighter)
- Body: `-0.01em` (normal)
- Labels/caps: `0.01em` (wide)

### Weight Usage

- **Regular (400)**: Body text, descriptions
- **Medium (500)**: Labels, nav items, subtle emphasis
- **Semibold (600)**: Headings, buttons, active states
- **Bold (700)**: Sparingly, only for critical emphasis

---

## Spacing Scale

Based on a 4px grid. All spacing values are multiples of 4px.

| Token | Value | Pixels | Common Usage                    |
|-------|-------|--------|---------------------------------|
| 0.5   | 2px   | 2      | Tight icon gaps                 |
| 1     | 4px   | 4      | Inline spacing, icon padding    |
| 1.5   | 6px   | 6      | Compact internal padding        |
| 2     | 8px   | 8      | Default gap, small padding      |
| 3     | 12px  | 12     | Card internal padding           |
| 4     | 16px  | 16     | Section padding, form gaps      |
| 5     | 20px  | 20     | Comfortable spacing             |
| 6     | 24px  | 24     | Panel padding                   |
| 8     | 32px  | 32     | Major section gaps              |
| 10    | 40px  | 40     | Large separations               |
| 12    | 48px  | 48     | Page-level spacing              |

### Layout Tokens

| Token    | Value | Usage            |
|----------|-------|------------------|
| sidebar  | 240px | Left sidebar     |
| panel    | 400px | Right panel      |
| panel-sm | 320px | Collapsed panel  |

---

## Border Radius

| Token   | Value | Usage                              |
|---------|-------|------------------------------------|
| sm      | 4px   | Tags, small badges                 |
| DEFAULT | 6px   | Inputs, buttons, small cards       |
| md      | 8px   | Cards, dropdowns                   |
| lg      | 12px  | Larger cards, modals               |
| xl      | 16px  | Feature panels                     |
| 2xl     | 20px  | Hero elements                      |
| full    | 9999px| Avatars, pills, status dots        |

---

## Shadows

Light, restrained shadows. In dark mode, shadows are less visible so we use subtle border + background shifts instead.

| Token        | Usage                         |
|--------------|-------------------------------|
| xs           | Subtle lift (buttons)         |
| sm           | Default card shadow           |
| md           | Dropdowns, popovers           |
| lg           | Modals, overlays              |
| xl           | Toast notifications           |
| inner        | Inset inputs                  |
| glow-{agent} | Active agent panel highlight  |

---

## Component Style Guidelines

### Buttons

- **Primary**: `bg-primary-600 text-white hover:bg-primary-700` with `rounded` and `px-4 py-2`
- **Secondary**: `bg-surface-raised border border-border text-text-primary hover:bg-surface-overlay`
- **Ghost**: `text-text-secondary hover:text-text-primary hover:bg-surface-overlay`
- **Danger**: `bg-danger-600 text-white hover:bg-danger-500`
- Height: 32px (sm), 36px (default), 40px (lg)
- Transition: `150ms ease` on background and border

### Inputs

- Use `.input-base` class from globals.css
- Background: `surface-inset`, border: `border`
- Focus: `border-primary-500` with subtle ring
- Height: 36px default, 32px compact

### Cards

- Use `.card` for standard surfaces, `.card-overlay` for floating elements
- Internal padding: `p-4` (16px) standard, `p-3` (12px) compact
- Always use `border-border-subtle` not just shadows

### Chat Messages

- User messages: slight primary tint background (`primary-600/15`)
- Assistant messages: `surface-raised` with subtle border
- Agent avatar with colored ring matching agent accent
- Tool calls: compact inline indicator with monospace text
- Timestamps: `text-text-tertiary text-xs`

### Sidebar

- Width: 240px (desktop), icon rail at 56px (tablet), hidden (mobile)
- Active item: `bg-surface-overlay` with left accent border using agent color
- Conversation items: truncated title, relative timestamp

### Right Panel

- Width: 400px collapsible
- Tab bar at top for switching contexts (Code, Preview, Canvas, Settings)
- Panel divider: 1px with hover highlight for resize

### Modals / Dialogs

- Backdrop: `bg-black/60 backdrop-blur-sm`
- Card: `.card-overlay` with `shadow-lg`, max-width 480px
- Enter animation: `scale-in` (150ms)

### Tooltips

- Background: `surface-overlay`, border, `shadow-md`
- Text: `text-xs text-text-secondary`
- Delay: 500ms before showing
- z-index: `tooltip` (80)

---

## Agent Visual Identity

Each agent has a consistent visual signature across the app:

### Coder (Cyan `#22d3ee`)
- Avatar: terminal/code icon with cyan ring
- Badge: `.agent-badge-coder`
- Active panel glow: `shadow-glow-coder`
- Code blocks and tool output use cyan accent for headers

### PM (Violet `#a78bfa`)
- Avatar: clipboard/chart icon with violet ring
- Badge: `.agent-badge-pm`
- Active panel glow: `shadow-glow-pm`
- Task items use violet checkbox accent

### Designer (Orange `#fb923c`)
- Avatar: pen/palette icon with orange ring
- Badge: `.agent-badge-designer`
- Active panel glow: `shadow-glow-designer`
- Canvas and diagram headers use orange accent

### General (Green `#4ade80`)
- Avatar: sparkle/chat icon with green ring
- Badge: `.agent-badge-general`
- Active panel glow: `shadow-glow-general`
- Default conversational styling

### Status Indicators
- **Idle**: gray dot (`gray-500`)
- **Thinking**: amber dot with pulse animation (`warning-400`)
- **Responding**: green dot (`success-400`)

---

## Animation Standards

All animations are fast and purposeful. No decorative or distracting motion.

| Animation        | Duration | Easing   | Usage                        |
|------------------|----------|----------|------------------------------|
| fade-in          | 150ms    | ease-out | Element appearance           |
| fade-up          | 200ms    | ease-out | Chat messages entering       |
| slide-in-right   | 200ms    | ease-out | Right panel opening          |
| slide-in-left    | 200ms    | ease-out | Sidebar appearing            |
| scale-in         | 150ms    | ease-out | Modals, dropdowns            |
| pulse-dot        | 1500ms   | ease-in-out (loop) | Thinking indicator  |
| thinking-shimmer | 2000ms   | linear (loop)      | Loading placeholder |

### Motion Principles
- Keep durations under 300ms for UI transitions
- Use `ease-out` for enters, `ease-in` for exits
- Reduce motion for `prefers-reduced-motion` users
- No spring/bounce animations -- keep it professional

---

## Icon Recommendations

Use **Lucide React** (`lucide-react`) as the icon library:
- Consistent 24x24 grid, 1.5px stroke weight
- Pairs well with the Inter typeface and clean aesthetic
- Tree-shakeable, only imports what you use

### Key Icon Mappings

| Element            | Icon              |
|--------------------|-------------------|
| Coder agent        | `Terminal`        |
| PM agent           | `ClipboardList`   |
| Designer agent     | `Paintbrush`      |
| General agent      | `Sparkles`        |
| Send message       | `ArrowUp`         |
| New conversation   | `Plus`            |
| Settings           | `Settings`        |
| Tool toggle        | `ToggleLeft/Right`|
| Code execution     | `Play`            |
| Stop generation    | `Square`          |
| Copy               | `Copy`            |
| Download/export    | `Download`        |
| Sidebar toggle     | `PanelLeftClose`  |
| Right panel toggle | `PanelRightClose` |
| Thinking           | `Loader2` (spin)  |

---

## Responsive Breakpoints

| Breakpoint | Width      | Layout                                                        |
|------------|------------|---------------------------------------------------------------|
| Desktop    | 1280px+    | Dashboard (2x2 grid + feed) + Detail panel side by side       |
| Tablet     | 768-1279px | Dashboard full width (2x2 grid), detail as overlay drawer     |
| Mobile     | <768px     | Dashboard as scrollable card stack, detail as fullscreen modal |

---

## Team Dashboard (Primary View)

The main screen is a **Mission Control** dashboard showing all agents simultaneously. Individual agent chats are secondary views accessed by drilling into an agent card. The dashboard never disappears -- it persists alongside the detail view in a split layout.

### Layout Concept: Split Mission Control

```
+------------------------------------------------------------------+
|  [logo] Swarm                    [model status] [settings]       |
+------------------------------------------------------------------+
|           TEAM DASHBOARD (primary)          |  AGENT DETAIL       |
|                                             |  (secondary)        |
|  +-------------------+ +------------------+ |                     |
|  | CODER        [cy] | | PM          [vi] | |  Agent: Coder       |
|  | Status: Working   | | Status: Idle     | |  +--------------+   |
|  | Task: "Build nav" | |                  | |  | Chat thread  |   |
|  | [####------] 40%  | | Last: "Broke     | |  |              |   |
|  |                   | |  down tasks"     | |  | ...messages  |   |
|  | Recent:           | |                  | |  |              |   |
|  | > Generated App.t | | 3 tasks created  | |  |              |   |
|  | > Ran sandbox     | |                  | |  +--------------+   |
|  | Tools: 3 active   | | Tools: 2 active  | |  [input bar]        |
|  | Tokens: 1.2k/4k   | | Tokens: 0.8k/4k  | |                     |
|  +-------------------+ +------------------+ |  Artifacts:         |
|                                             |  [code] [preview]   |
|  +-------------------+ +------------------+ |                     |
|  | DESIGNER     [or] | | GENERAL     [gr] | |                     |
|  | Status: Thinking  | | Status: Idle     | |                     |
|  | Task: "Arch diag" | |                  | |                     |
|  | [thinking...]     | | "Ready to help"  | |                     |
|  |                   | |                  | |                     |
|  | Recent:           | |                  | |                     |
|  | > Mermaid render  | |                  | |                     |
|  | Tools: 2 active   | | Tools: 0 active  | |                     |
|  | Tokens: 0.5k/4k   | | Tokens: 0/4k     | |                     |
|  +-------------------+ +------------------+ |                     |
|                                             |                     |
|  +-----------------------------------------+|                     |
|  | ACTIVITY FEED (unified timeline)         |                     |
|  | [cy] Coder ran run_javascript   2s ago   |                     |
|  | [vi] PM created 3 tasks         15s ago  |                     |
|  | [or] Designer thinking...       now      |                     |
|  +-----------------------------------------+                     |
+------------------------------------------------------------------+
```

### Dashboard Grid

The dashboard uses a 2x2 grid of **Agent Cards** plus a unified **Activity Feed** below.

- **Desktop (1280px+)**: Dashboard (60%) + Detail Panel (40%), side by side
- **Tablet (768-1279px)**: Dashboard full width, detail panel as overlay drawer from right
- **Mobile (<768px)**: Dashboard as scrollable card stack, detail as full-screen overlay

When no agent is selected, the detail panel shows a welcome/overview state. Clicking an agent card opens its detail view in the right panel without leaving the dashboard.

### Agent Status Card

Each agent gets a card on the dashboard. The card is the primary visual unit.

```
+------------------------------------------+
|  [icon]  CODER                    [dot]  |   <- agent name + status dot
|  "Building navigation component"         |   <- current task / last message
|                                          |
|  [========--------] 3/8 iterations       |   <- progress bar (if working)
|                                          |
|  Recent Activity:                        |
|  > Generated App.tsx         3s ago      |   <- last 2-3 actions
|  > Executed sandbox          8s ago      |
|                                          |
|  Tools: 3 active   Tokens: 1.2k / 4k    |   <- footer metrics
+------------------------------------------+
```

**Card states:**

| State      | Visual Treatment                                                    |
|------------|---------------------------------------------------------------------|
| Idle       | Default `.card` surface, gray status dot, muted text                |
| Thinking   | Left border accent in agent color, amber pulse dot, shimmer effect  |
| Working    | Left border accent, green dot, progress bar visible                 |
| Error      | Left border `danger-500`, red dot, error summary text               |
| Selected   | Agent glow shadow (`shadow-glow-{agent}`), elevated surface         |

**Card dimensions:**
- Min width: 280px, max width: flexible (fills grid cell)
- Height: auto, min ~160px
- Internal padding: `p-4`
- Gap between cards: `gap-4` (16px)
- Border radius: `rounded-lg` (12px)

### Activity Feed

A unified chronological feed below the agent grid, showing all agent actions in one stream. Think of it as a team Slack channel.

```
+------------------------------------------------------------------+
|  ACTIVITY                                          [filter] [v]  |
|------------------------------------------------------------------|
|  [cy dot] Coder  > Executed run_javascript            just now   |
|           Output: "Hello World"  [expand]                        |
|  [or dot] Designer  > Called render_mermaid            2s ago     |
|           Generated flowchart diagram  [view]                    |
|  [vi dot] PM  > Created task "Implement auth"         15s ago    |
|  [cy dot] Coder  > Generated src/App.tsx              20s ago    |
|  [gr dot] General  > Completed response               1m ago    |
+------------------------------------------------------------------+
```

**Feed item structure:**
- Agent color dot + name (left)
- Action description (center)
- Relative timestamp (right)
- Optional expandable detail (output preview, artifact link)
- New items animate in with `fade-up` (200ms)

**Feed filtering:**
- Filter by agent type (toggle chips at top)
- Filter by action type: messages, tool calls, artifacts, errors

### Detail Panel (Agent Drill-Down)

When an agent card is clicked, the right portion of the screen shows the agent's detail view. This is NOT a page navigation -- it's a panel that coexists with the dashboard.

**Detail panel contains:**
1. **Agent header**: Icon, name, status badge, tool toggles button
2. **Chat thread**: Full conversation with that agent (scrollable)
3. **Input bar**: Send messages to this specific agent
4. **Artifact tabs**: Code editor, diagram preview, task board (contextual to agent type)

The panel width is `panel` (400px) on large screens, expanding to `panel-lg` (560px) when artifacts are shown alongside chat.

### Handoff Visualization

When an agent hands off to another, the dashboard shows it visually:
- A brief connection line or arrow animation between the two agent cards
- The receiving agent's card pulses with the sending agent's color briefly
- Activity feed shows: `[cy] Coder handed off to [vi] PM: "Requirements needed"`

### New Layout Tokens

| Token      | Value | Usage                         |
|------------|-------|-------------------------------|
| panel-lg   | 560px | Expanded detail panel         |
| card-agent | 280px | Minimum agent card width      |
| feed-h     | 200px | Activity feed default height  |

### New Component Classes

| Class               | Usage                                    |
|---------------------|------------------------------------------|
| `.agent-card`       | Dashboard agent status card              |
| `.agent-card-active`| Selected agent card (glowing)            |
| `.feed-item`        | Single activity feed entry               |
| `.progress-bar`     | Agent iteration progress indicator       |
| `.detail-panel`     | Right-side agent detail view             |
| `.handoff-arrow`    | Animated handoff connection between cards|

### Dashboard vs Chat: Navigation Model

| View           | Access                              | Persistence                  |
|----------------|-------------------------------------|------------------------------|
| Team Dashboard | Default primary view, always visible| Left side of split layout    |
| Agent Detail   | Click agent card on dashboard       | Right panel, closeable       |
| Agent Chat     | Inside agent detail panel           | Scrollable within panel      |
| Artifacts      | Tab within agent detail panel       | Tab state preserved          |
| Settings       | Header gear icon or Cmd+,          | Modal overlay on dashboard   |

The sidebar from the original design is **removed** as the primary nav. Conversation history is accessible from within each agent's detail panel or from a global search (Cmd+K).

---

## Accessibility

- All interactive elements must have visible focus indicators (2px ring)
- Color is never the only signifier -- always pair with text labels or icons
- Minimum contrast ratio: 4.5:1 for text, 3:1 for large text and UI elements
- Respect `prefers-reduced-motion` for all animations
- Keyboard navigation: Tab through all interactive elements, Escape to close overlays
