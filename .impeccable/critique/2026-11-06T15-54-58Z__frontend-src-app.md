---
target: general UI - web app shell and primary pages
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
p2_count: 2
target_identity: "file:C:\\Users\\SENA\\Documents\\COLD_DAY_BACKEND\\frontend\\src\\app"
timestamp: 2026-11-06T15-54-58Z
slug: frontend-src-app
---
⚠️ DEGRADED: single-context (subagent depth limit — nested sub-agents unavailable)

Target: `frontend/src/app` (web app shell + primary pages). Mode: Operate. Surface: Spanish-language field-services platform (COLD DAY S.A.S., Cúcuta).

# Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Loading is a 12px text line ("Cargando órdenes…"); no skeletons (0 `p-skeleton`), no step progress in the 3-step request form. |
| 2 | Match System / Real World | 2 | Raw enums leak to UI (`BUSCANDO_TECNICO`, `DISPONIBLE`); Rioplatense voseo in a Colombian product; jargon ("Broadcast radar", "Torre de Control", "OTs") for homeowners. |
| 3 | User Control and Freedom | 2 | Back links exist per page but no breadcrumbs; no undo on admin actions; confirm dialog has no close button; filters have no clear-all. |
| 4 | Consistency and Standards | 2 | Two visual worlds (light web vs Dark Ops mobile); voseo vs tuteo in the same product; four radius families; two currency formats. |
| 5 | Error Prevention | 3 | Confirmation dialogs, disabled submits, required markers, constrained selects — but no draft recovery; a refresh loses the multi-step form. |
| 6 | Recognition Rather Than Recall | 3 | Labels accompany icons everywhere except the collapsed sidebar; no search across 40 pages; no recent items. |
| 7 | Flexibility and Efficiency | 1 | Zero keyboard handlers (`keydown`/`HostListener` = 0); no sortable columns, no bulk actions, no saved filters, no density control. |
| 8 | Aesthetic and Minimalist Design | 2 | Each KPI gets its own hue; 74 `font-black`/`font-extrabold`; gradient banners on operational screens. |
| 9 | Error Recovery | 2 | `app-carga-error` is genuinely good (role=alert + retry); messages stay generic; no field-level recovery. |
| 10 | Help and Documentation | 1 | No in-app help, docs, or contextual hints beyond placeholders. |
| **Total** | | **20/40** | **Acceptable** |

# Design Specificity Verdict

**LLM assessment:** Category-interchangeable on the web, authored on mobile. The web app is a Tailwind SaaS admin starter: white `rounded-3xl` cards on `slate-100`, `font-black` headings, a sky→cyan gradient hero, six KPI tiles, a hand-rolled SVG bar chart and donut. Swap the Spanish strings and it could ship as a CRM, a gym back-office, or a logistics dashboard. Nothing in the composition says *Cúcuta*, *90-day acta*, *consignación*, *técnico auditado*, or *dispute mediation*.

The damning part is that the authored world already exists in this repo: `docs/design/dark-ops/` and `frontend/projects/mobile/src/styles.css` define a real, specific language — `#0b1220` canvas, `#22d3ee` accent, Space Grotesk headlines, Space Mono micro-labels, 12px cards, hairline borders, 8px controls. The mobile app is that company. The web app is a different company. A technician who accepts a job on the phone and then opens the desktop panel crosses a brand border.

**Deterministic scan:** `impeccable detect frontend/src/app` → 3 findings, exit 1:
- `ai-color-palette` ×2 — `text-indigo-600` on `dashboard-admin-page.html:0`, `text-purple-600` on `disputas-admin-page.html:0`. Legitimate: indigo/purple accents on top of sky/cyan/emerald/amber is the "AI palette" tell, and here the hues carry no semantic rule.
- `broken-image` ×1 — `<img>` with no `src` in `seguimiento-ot-page.html`. Legitimate; ships a broken box.

**Visual overlays:** not available. No browser automation and no running server in this session, so no overlay was injected. Findings are source-level only.

# Overall Impression

The engineering care is visible in the primitives — `app-empty-state`, `app-carga-error`, `app-estado-badge` are consistent, honest, reusable. The copy is written by someone who understands the business (garantía, acta, consignación, mediación). But the visual layer was assembled per page, not designed as a system, and the product has two identities that never met. The single biggest opportunity: **make the web app adopt the Dark Ops world that the mobile app already proves this brand can own.**

# What's Working

1. **Honest states, shared as components.** `carga-error` ships `role="alert"` with a retry action instead of a silent failure; `empty-state` gives every filter a titled, explained, actionable void. This is rarer than it should be and it is the strongest signal of product maturity here.
2. **Domain-true microcopy in empty states.** "Solicitar Asistencia", "Revisar Presupuesto", "Volver a la solicitud" — verbs tied to the actual job, not generic "Submit".
3. **The blocked-technician banner states the rule and the remedy.** `panel-tecnico-page.html:4-26` explains the 12% commission hold and offers "Legalizar Consignación Ahora". High-stakes state, plain language, one action.

# Priority Issues

- **[P1] Two visual worlds, and 902 `dark:` classes that never fire.**
  Why it matters: `frontend/src/app` contains 902 `dark:` utility occurrences and zero code paths that add `.dark` to `<html>` (`styles.css:5-8` admits it: "la variante dark queda inerte"). So every one of those classes is dead markup, and every page was *designed* for a dark surface that users never see. Meanwhile the Ionic app is fully dark. Users see inconsistency; maintainers read intent that the runtime contradicts.
  Fix: decide one world — Dark Ops on web — bind it in `styles.css` (`--color-*` to tokens), delete the dead `dark:` variants in the same pass, and stop paying the readability tax in 40 templates.

- **[P1] Accessibility floor is below AA on the primary reading surface.**
  Why it matters: 122 declarations of 9/10/11px text; 156 uses of `text-slate-400` (`#94a3b8` = 2.56:1 on white, 2.3:1 on `slate-100`), used for KPI captions ("OTs activas", "Broadcast radar"), table cells, and timestamps. `aria-label` appears 6 times across 40 HTML files; 55 `focus:` utilities total, and hand-rolled `<button>`s in `solicitar-servicio-page.html` and `panel-tecnico-page.html` carry none. SVG charts have no `role="img"`, no `<title>`, no data table fallback — screen readers get nothing from the admin analytics.
  Fix: 12px floor for all text, `slate-600` for secondary, a single `focus-visible` ring utility applied to every interactive element, `aria-label` on the icon-only topbar buttons, and `role="img"` + `aria-label` on both dashboard charts.

- **[P1] Colombian users are reading Rioplatense Spanish, next to raw database enums.**
  Why it matters: `panel-cliente-page.html:13` says "Pedí un servicio"; `:43` says "Todavía no tenés perfil". Cúcuta uses tuteo — "Pide", "no tienes" — and the same product elsewhere does tuteo ("Ingresa los detalles", `solicitar-servicio-page.html:12`). Register flips mid-journey, which reads as machine-written to the exact audience it addresses. Worse, `monitoreo-ot-page.html:45-53` shows `BUSCANDO_TECNICO`, `EN_DIAGNOSTICO`, `FINALIZADA` as option labels.
  Fix: normalize to neutral Colombian tuteo; add one `estadoLabel` map (single source) and use it in filters, badges, and tables.

- **[P2] The Operate surface has no Operate affordances.**
  Why it matters: `monitoreo-ot-page.html:74` renders an 8-column table at `text-xs` inside `overflow-x-auto` — no sticky header, no sortable columns, no column priorities for narrow screens, and the only row action is an 11px "Detalle" link. Admin queues (disputas, consignaciones, validación de técnicos) are one-row-at-a-time. There is no keyboard path anywhere in the app: zero `keydown` handlers, zero command palette, zero shortcuts.
  Fix: sortable headers + sticky thead, collapse low-priority columns under a summary cell below `lg`, make the whole row the link, add bulk selection with a sticky action bar, and wire `/` to search plus `j/k/Enter` on queue tables.

- **[P2] No typographic or shape system, and the font you pay for is never applied.**
  Why it matters: `index.html:16` downloads Plus Jakarta Sans in five weights; no `font-family` rule anywhere references it, so the UI renders in Tailwind's default system stack. Hierarchy is carried by weight saturation (74 `font-black`/`font-extrabold`) rather than scale, and radii are ad hoc — 68 `rounded-3xl` alongside `rounded-2xl`, `rounded-xl`, `rounded-full` for comparable objects.
  Fix: declare `@theme { --font-sans: "Plus Jakarta Sans", ... }` (or adopt Space Grotesk/Inter from Dark Ops), define a five-step scale with a 700 weight ceiling, and allow exactly two radii.

# Persona Red Flags

**Alex (Power User)**: Opens the admin monitor, wants last week's disputed OTs — must retype the search and re-pick both selects on every visit; no sort, no saved view. Wants to reconcile 40 consignaciones; the queue only accepts one at a time. Tries `j`/`Enter`; nothing. Collapses the sidebar to gain width and loses all labels to hover-only tooltips.

**Sam (Accessibility-Dependent)**: Reads KPI captions at 9–11px in `slate-400` on white — fails AA before zoom. Tabs into the category cards in `solicitar-servicio-page.html`: the buttons have no focus ring, so selection is invisible while navigating by keyboard. Reaches the dashboard charts: both `<svg>` elements are unlabeled, so the core analytics screen is silent. The blocked-account banner (`panel-tecnico-page.html:5`) pulses indefinitely with `animate-pulse` and ignores `prefers-reduced-motion`.

**Jordan (First-Timer, homeowner)**: Lands on the client panel and reads "Panel de Autogestión Cliente", "Broadcast", and tables of "OTs activas". Starts the request flow: three numbered sections but no "step 1 of 3", no save, and a refresh wipes the form. On a failed submit, the only feedback is a toast; nothing is marked at the offending field.

# Minor Observations

- `dashboard-admin-page.html:113` uses `viewBox="0 0 500 180"` with `preserveAspectRatio="none"`, so axis labels and bar proportions distort at every breakpoint.
- Bar heights hardcode a max of 20 (`(h.completadas / 20) * 140`): any day above 20 overflows the plot.
- Currency is formatted two ways: `(totalRecaudoMesCop / 1000000).toFixed(1)` + "M" vs `toLocaleString('es-CO')` in the table.
- `panel-tecnico-page.html:41` falls back to a fabricated `4.9` reputation, and `login-page.html:46` advertises "4.9★ reputación media" — same invented number, presented as fact.
- The login screen spends 40% of desktop width on marketing claims for an internal operations tool; the technician who logs in daily pays for it every morning.
- `ot.categoriaServicio.replace('_',' ')` (no `/g`) only fixes the first underscore.
- Toast host is bottom-right on desktop and 90vw on mobile — fine, but success is invisible on long pages without a scroll-to context.
- `animate-pulse` on a destructive/blocking state is the only animation in the web app.

# Questions to Consider

- If the web app adopted the Dark Ops tokens, would anything in the codebase break — or would it just delete 902 dead classes?
- What would the admin monitor look like if it were designed from "I need to find the one OT that is stuck", instead of from "I have eight columns of data"?
- Is the fabricated 4.9 rating doing marketing work that the actual review data cannot support yet?
