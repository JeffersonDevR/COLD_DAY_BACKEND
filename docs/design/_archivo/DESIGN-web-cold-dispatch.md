---
name: COLD DAY — Cold Dispatch
description: Dark operational console for a technical home-services network in Cúcuta, Colombia.
colors:
  canvas: "#0b1220"
  surface: "#111b2e"
  surface-elevated: "#16243a"
  surface-well: "#0e1828"
  border: "#1e293b"
  border-strong: "#334155"
  signal: "#22d3ee"
  signal-hover: "#06b6d4"
  signal-pressed: "#1ebad1"
  text-primary: "#f8fafc"
  text-body: "#e2e8f0"
  text-label: "#cbd5e1"
  text-secondary: "#94a3b8"
  warning: "#f59e0b"
  warning-ink: "#fcd34d"
  success: "#22c55e"
  success-ink: "#6ee7b7"
  danger: "#f87171"
  danger-ink: "#fca5a5"
  tertiary: "#a78bfa"
  tertiary-ink: "#c4b5fd"
typography:
  display:
    fontFamily: "Space Grotesk, Inter, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Space Grotesk, Inter, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0em"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.06em"
  code:
    fontFamily: "Space Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.02em"
rounded:
  badge: "4px"
  control: "8px"
  card: "12px"
  overlay: "16px"
  pill: "999px"
spacing:
  "2xs": "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  "2xl": "48px"
components:
  button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "#042f2e"
    typography: "{typography.title}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.signal-hover}"
    textColor: "#042f2e"
    rounded: "{rounded.control}"
  button-primary-pressed:
    backgroundColor: "{colors.signal-pressed}"
    textColor: "#042f2e"
    rounded: "{rounded.control}"
  button-secondary:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.text-body}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-label}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  input:
    backgroundColor: "{colors.surface-well}"
    textColor: "{colors.text-body}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "40px"
  tag:
    backgroundColor: "{colors.surface-well}"
    textColor: "{colors.text-label}"
    typography: "{typography.label}"
    rounded: "{rounded.badge}"
    padding: "2px 8px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "16px"
---

# Design System: COLD DAY — Cold Dispatch

## Overview

**Creative North Star: "Cold Dispatch"**

Cold Dispatch is the night dispatch room of a refrigeration network. The console is on all night. Orders arrive, get picked up, move across the city, and close. Everything on screen answers one of three questions in under a second: *what is live, what is stuck, and who is responsible for it.*

The world is a deep navy that never turns black. Two surfaces — a canvas and a raised plane — plus a well for anything you type into. Depth is carried by a one-pixel hairline and a tonal step, never by a drop shadow; the only light in the room is a single cyan signal that means "this is live or this is interactive". Color is deployed as information, not decoration: amber means money or waiting, green means settled, red means attention, violet means parts and disputes. A screen with no state to report is nearly monochrome, and that is correct.

Density is high and deliberate. This is a control tower, not a dashboard for showing off: rows are short, columns are stable, headers stay put, and the eye learns one scan path per board. Typography does the hierarchy work that the old `font-black` stack was trying to do with weight alone — a display face for the screen's name, a text face for everything read in sentences, and a monospace face for anything read character by character: order codes, verification codes, coordinates, amounts.

The mobile app is the proven expression of this world. The web app is its desk-mounted console: same instrument, more of it. The light sky-blue storefront in `landing/` belongs to the marketing surface and is explicitly outside this system.

**Key Characteristics:**
- Deep navy canvas, one raised surface, one inset well. No black, no pure white text.
- A single cyan accent, used on ≤10% of any screen.
- Flat by default; hairlines and tonal steps instead of shadows.
- Three typefaces with three jobs: display, text, data.
- 12 px type floor and a 700 weight ceiling, no exceptions.
- Status is a tag, and the tag has a fixed position on every board.

## Colors

A monochrome navy instrument panel interrupted, only where it matters, by one cyan signal and four semantic inks.

### Primary
- **Signal Cyan** (#22d3ee): the only interactive accent. Primary actions, active navigation, focus rings, selected rows, live indicators, and the current step in a lifecycle. It is a signal, not a brand color — it is allowed to be this bright because it appears so rarely.

### Secondary
- **Money Amber** (#f59e0b): anything about payment, commission, settlement, or a pending decision, plus the "searching for a technician" state. Amber always means *this needs a human or a transaction*.

### Tertiary
- **Parts Violet** (#a78bfa): supplier dispatches, parts and insumos, and dispute mediation. Violet is the only place where a supplier-facing concept gets its own colour.

### Neutral
- **Canvas** (#0b1220): the page background, every screen, no exceptions.
- **Surface** (#111b2e): the raised plane — topbar, sidebar, cards, panels, table containers.
- **Surface Elevated** (#16243a): a second step for controls that sit on a surface, and hover on a surface row.
- **Surface Well** (#0e1828): every input, textarea, select, and inset content block. A well is *inside* the plane.
- **Border** (#1e293b): the default hairline. Separators, panel edges, table rules.
- **Border Strong** (#334155): the hairline that must be seen — dashed placeholders, focused panels, the edge of a well.
- **Text Primary** (#f8fafc): page and section headings only.
- **Text Body** (#e2e8f0): default text, table cells, form values.
- **Text Label** (#cbd5e1): field labels, secondary values, dense metadata.
- **Text Secondary** (#94a3b8): helper text, timestamps, descriptions, placeholders.
- **Success Ink** (#6ee7b7) on `success` (#22c55e) at 12% / **Danger Ink** (#fca5a5) on `danger` (#f87171) at 10% / **Warning Ink** (#fcd34d) on `warning` at 12% / **Tertiary Ink** (#c4b5fd) on `tertiary` at 14% — status is ink on tint, never a filled solid. Action buttons are the one exception: they fill with their hue at step 700 and carry white ink, because a fill has to earn its own contrast.

### Named Rules
**The One Signal Rule.** Signal cyan covers at most 10% of any screen. If two things on a page are both cyan, one of them is decoration and must lose.

**The Border-Before-Color Rule.** When two regions need separating, reach for a hairline first. Colour is what you add when the border alone is not saying enough — not the other way round.

**The #64748b Ban.** `#64748b` and `#475569` never carry text on canvas, surface, or well. On `canvas` they measure 3.9:1 and 2.5:1 — both under AA. Use `#94a3b8`, which measures 7.3:1, for anything that must be read; `#cbd5e1` measures 12.6:1.

## Typography

**Display Font:** Space Grotesk (with Inter, sans-serif)
**Body Font:** Inter (with system sans-serif)
**Label/Mono Font:** Space Mono (with ui-monospace)

**Character:** Space Grotesk is slightly technical and slightly cold, which suits an instrument panel; Inter carries the sentences without competing; Space Mono makes identifiers un-misreadable at a glance. The pairing reads as *calibrated*, not as *branded*. Plus Jakarta Sans, used today on web, is retired — it belongs to the storefront, not the console.

### Hierarchy
- **Display** (700, 2rem / 32px, lh 1.1, ls −0.02em): page titles and the one number that leads a board. Maximum one per screen.
- **Headline** (700, 1.5rem / 24px, lh 1.2, ls −0.01em): section headings inside a page, panel titles, modal titles.
- **Title** (600, 1rem / 16px, lh 1.4): card titles, table group headers, button labels, the name of a record.
- **Body** (400, 0.875rem / 14px, lh 1.5): all running text, table cells, form values. Long-form blocks cap at 70ch.
- **Label** (600, 0.75rem / 12px, lh 1.3, ls 0.06em, uppercase only for eyebrows): field labels, column headers, tag text, table metadata.
- **Code** (400, 0.75rem / 12px, lh 1.4, ls 0.02em, Space Mono): OT codes, verification codes, coordinates, currency amounts, dates that must align.

### Named Rules
**The 700 Ceiling Rule.** Nothing renders heavier than 700. `font-black` (900) and `font-extrabold` (800) are banned outright — the incumbent web app uses them 74 times and the result is a screen where everything shouts.

**The 12px Floor Rule.** No text below 12px. The incumbent app declares 122 arbitrary sizes at 9, 10, and 11px; every one of them becomes 12px. If a label does not fit at 12px, the label is too long, not the type too big.

**The Mono-Is-Data Rule.** Space Mono is reserved for values a human compares character by character. Never for a sentence, never for a button, and never for a heading — with one exception: an uppercase eyebrow of two or three words.

## Layout

**The shell.** A 64px fixed topbar on `surface` with a single bottom hairline; a sidebar of 256px expanded and 64px collapsed, also on `surface`, separated by a hairline rather than a shadow; content below, with a container capped at 1600px and page padding of 16 / 24 / 32px at `sm` / `lg` / `xl`. The footer is subordinate and never hosts navigation.

**The page.** Header row carries the title and exactly one primary action. Filters sit immediately below, always visible, with a single reset. The working surface — board, table, or form — fills the remaining height. Secondary actions live in the row or on the record; nothing floats above the fold.

**The grid.** 12 columns, 24px gutter, 4px base rhythm (4 / 8 / 12 / 16 / 24 / 32 / 48). Panels are separated by 16px, sections by 24px, page blocks by 32px.

**Density.** Table rows are 40px, or 32px in compact mode where an operator scans rather than reads. Control heights ladder: 32px dense, 36px compact, 40px default, 48px primary touch and mobile CTA. A dense screen is not a cramped screen — density comes from row height and rhythm, never from shrinking type below the floor.

**Responsive behaviour.** Below `lg` (1024px) the sidebar becomes a drawer and the topbar keeps only the menu, the brand, and the identity. Table columns are prioritised, not scrolled: identity, status, age, and amount survive; everything else drops. Below `sm` (640px) the page padding is 16px and multi-column forms collapse to one column.

## Elevation & Depth

This system is flat. There are no Material shadows, no ambient elevation, and no card that lifts on hover. Depth is communicated by three devices only: the tonal step from canvas to surface to elevated, the one-pixel hairline that marks an edge, and the inset well that marks a field.

Three shadow tokens exist, each with a single job, and none of them is decoration.

### Shadow Vocabulary
- **Accent Glow** (`0 0 20px rgba(34, 211, 238, 0.25)`): the primary CTA only. It reads as the button being powered.
- **Accent Halo** (`0 0 32px rgba(34, 211, 238, 0.18)`): the brand mark and the "live" indicator on an active map pin.
- **Overlay** (`0 24px 64px rgba(2, 6, 23, 0.72)`): modals, popovers, dropdown panels — anything that genuinely leaves the plane.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. If you are reaching for a shadow to separate two regions, you want a border. If you are reaching for a shadow to show that something is interactive, you want a hover background from `surface-elevated`.

**The Glow-Is-A-Status Rule.** The accent glow is never used on a secondary button, a card, or a hover state. It appears on the primary action and on the live indicator, and nowhere else.

## Shapes

Corners come in a five-step ladder, and each step has exactly one job: badges and tags at 4px, controls (buttons, inputs, selects, wells) at 8px, cards and panels at 12px, overlays and modals at 16px, and true pills at 999px for status chips and counters.

Borders are 1px hairlines in `border`, or `border-strong` when the edge must be seen. Dashed hairlines are reserved for absence: empty states, placeholder slots, and "nothing has been dropped here yet" zones. There is no thick border, no double border, and no decorative divider.

Gradients are not part of this system. The brand mark is a solid signal-tinted tile, not a `from-sky-600 to-cyan-500` sweep.

## Components

### Buttons
- **Shape:** 8px radius, 40px height default, 36px compact, 48px for the primary CTA on touch surfaces.
- **Primary:** signal cyan background, `#042f2e` text — dark ink on a bright fill, which is the only place in the system where dark text sits on a solid colour. Optional accent glow. Label in Title weight, sentence case, never uppercase.
- **Hover / Focus:** background steps to signal-hover; pressed steps to signal-pressed with a 1% scale. Focus is a 2px signal outline at 1px offset, never a soft shadow.
- **Secondary:** `surface-elevated` background with a `border` hairline and body-weight text. The default action for anything that is not the page's one primary job.
- **Ghost:** transparent, text-label colour, hover background `surface-elevated`. Only for row actions and toolbar toggles.
- **Destructive:** danger ink text on a 10% danger tint with a danger hairline. Never a solid red fill.
- **Semantic actions:** an approve, reject, or resolve button fills at step 700 of its hue with white ink. Step 600 with white ink measures 3.3–4.2:1 and is banned; step 700 measures 5.4–7.9:1 across every hue.

### Chips and Tags
- **Style:** status tags use a 4px radius with ink-on-tint colour; filter chips use the pill radius with a hairline and text-secondary.
- **State:** an active filter chip takes signal ink, 10% signal tint, and a signal border. An unselected chip is a hairline and muted text. Status is always tag-on-surface, never a coloured dot without a label — a colour alone does not survive a colour-blind operator or a printed screen.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** `surface`, or `surface` at 60% opacity when the card is an informational aside rather than a work surface.
- **Shadow Strategy:** none. See Elevation.
- **Border:** 1px `border`. `border-strong` only when the card is the focused or selected object.
- **Internal Padding:** 16px default, 12px in dense table-adjacent cards, 24px for a page-level panel.

### Inputs / Fields
- **Style:** 40px height, 8px radius, `surface-well` background, 1px `border`, text-body value, text-secondary placeholder.
- **Focus:** 2px signal outline at 1px offset, plus the border shifting to signal. No glow, no colour fill change.
- **Error:** danger hairline plus danger ink below the field, and `aria-invalid`. The message names the problem and the fix, in tuteo.
- **Disabled:** `text-secondary` value, 60% opacity, and a dashed hairline — visibly out of service rather than merely faded.

### Navigation
- **Shell:** fixed topbar (`surface`, 64px, bottom hairline) and collapsible sidebar (`surface`, left hairline). The active sidebar item takes a signal-tinted background, signal ink, and a 2px signal left rule; it does not become a filled cyan block.
- **Typography:** navigation labels in Title weight at 14px. Section eyebrows in Label weight, uppercase, text-secondary.
- **Mobile:** sidebar becomes a drawer at `lg`; the topbar keeps brand, menu, and identity only.

### Tables (signature component)
The monitoring board is where this system earns its keep. Sticky header with a sort affordance on every sortable column. 40px rows, 1px `border` rules, no zebra fill. The whole row is the link — a trailing "ver" button is not the affordance. Status tag sits in the same column on every board so the eye learns one scan path. Row hover is `surface-elevated`; a selected row is a signal tint at 8% with a signal left rule. An exception — stalled, overdue, awaiting a human — gets a 2px warning left rule, never a red pulsing row.

### Lifecycle Timeline
A horizontally scrollable sequence of 32px nodes on the `surface`, one per state, with completed nodes in success green, the current node in signal cyan with a 4px halo, and future nodes as `border`-outlined circles in text-secondary. Labels in 12px. A node is never a floating icon without a label; the label is what makes the stage nameable in a meeting.

## Do's and Don'ts

### Do:
- **Do** start every new surface from the three-layer stack: canvas → surface → well, in that order.
- **Do** use the 12/14/16px trio for almost all text, and reserve Display for one element per screen.
- **Do** give every state a tag with text in it, in a fixed column position.
- **Do** keep the focus ring at 2px signal at 1px offset on every interactive element, including hand-rolled `<button>`s that Tailwind's reset stripped.
- **Do** honour `prefers-reduced-motion` — every animation in this system has a static equivalent.
- **Do** name what failed in an error state, and offer the retry next to it.

### Don't:
- **Don't** use `#64748b` or `#475569` for text on any dark surface; they fail contrast.
- **Don't** use `font-black`, `font-extrabold`, or any weight above 700 — the current web app does this 74 times and the hierarchy it buys is false.
- **Don't** set type below 12px, including "micro" labels and chart axes.
- **Don't** add a drop shadow to a card, a row, or a button to signal elevation or hover.
- **Don't** put a gradient on anything, including the brand mark.
- **Don't** ship a `dark:` variant. This system has exactly one appearance; a `dark:` prefix that never activates is dead code pretending to be a feature.
- **Don't** use a colour-only status indicator — no bare dot, no colour-coded row without a textual state.
- **Don't** invent a hover animation beyond a background step and a 150ms colour transition.
