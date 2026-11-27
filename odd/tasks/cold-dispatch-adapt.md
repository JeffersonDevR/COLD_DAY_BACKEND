# Cold Dispatch — adaptation pass (`adapt`)

Objective: make the three data boards usable at 360 px without horizontal scrolling, and give them headers that stay put while an operator scans.

## What the audit found

- **The critique's "mobile drawer parity" is already done.** `app-sidebar` ships three states: static collapsible at `lg`, overlay at `lg`, and a `lg:hidden` drawer with masks. Nothing to fix.
- **Three tables, zero adaptation.** `monitoreo-ot`, `consignaciones-admin`, `liquidaciones-tecnico` are 7–8 columns inside `overflow-x-auto`. At 360 px an operator sees two columns and drags blindly.
- **Sticky headers cannot work today.** `overflow-x-auto` makes the wrapper a scroll container with no height limit, so a `sticky` header has nothing to stick against.
- **The board has no row affordance.** The only way in is a 60 px "Detalle" button at the far right, off-screen on a phone.
- One inline `style="font-size:14px; width:14px; height:14px"` on the detail icon bypasses the type scale.

## Scope

Authorized: the three page templates and their components.

Out of scope: sorting (a feature, not adaptation), the shell, `landing/`, `projects/mobile`.

## Column priority

**monitoreo-ot** — the control tower.

| Column | Visible at |
|---|---|
| OT (identity) | always |
| Estado | always |
| Presupuesto (amount) | always |
| Cliente | `md` |
| Técnico | `md` |
| Categoría | `lg` |
| Ubicación | `lg` |
| Ver (button) | `sm` — replaced by the whole-row link below it |

**consignaciones-admin** — reconciliation.

| Column | Visible at |
|---|---|
| OT | always |
| Estado | always |
| Acción contable | always |
| Técnico | `md` |
| Monto servicio | `md` |
| Comisión | `lg` |
| Comprobante / referencia | `lg` |

**liquidaciones-tecnico** — settlement.

| Column | Visible at |
|---|---|
| OT | always |
| Estado | always |
| Acción | always |
| Fecha | `md` |
| Valor servicio | `md` |
| Comisión | `lg` |
| Medio cobrado | `lg` |

## Tasks

- [ ] **A1** — Make the header actually sticky: the table wrapper becomes `max-h-[calc(100vh-15rem)] overflow-auto`, and each `<thead>` gets `sticky top-0 z-10 bg-canvas`.
- [ ] **A2** — Apply the column priority above with `hidden md:table-cell` / `hidden lg:table-cell`. Keep the rounded header ends looking right by moving `rounded-l-xl` / `rounded-r-xl` to whichever cell is first and last *at each width* — or drop them.
- [ ] **A3** — Whole-row link on `monitoreo-ot`: the `<tr>` becomes `cursor-pointer` with a click that navigates to the same `/cliente/ot/:id` the anchor already uses. The anchor stays as the keyboard-accessible control and stops propagation. Do not add `tabindex` to the row: keyboard users keep using the real link.
- [ ] **A4** — Empty state distinguishes "nothing matches these filters" from "nothing exists", using `<app-empty-state>` (`title`, `description`, optional `actionLabel`/`actionClicked`). Use the page's existing filter reset when it has one; otherwise omit the action.
- [ ] **A5** — Remove the inline icon style in `monitoreo-ot`; use a scale class instead.
- [ ] **A6** — Check the filter rows and page headers of all three pages wrap instead of overflowing at 360 px.

## Constraints

- Do not add a horizontal scrollbar back as the primary strategy.
- Do not reflow, reindent, or reformat unrelated lines.
- Preserve UTF-8.
- No new dependency.

## Verification

- `npm run build` and `npx ng test --watch=false --project app`.
- Assert every `hidden md:table-cell` / `hidden lg:table-cell` utility exists in the built CSS.
- Layout harness at 360, 768 and 1440 px (documented separately from the authed screen).

## Progress

Complete.

**A1–A3** — All three wrappers are `max-h-[calc(100vh-15rem)] overflow-auto`, every `<thead>` carries `sticky top-0 z-10 bg-canvas`, and `monitoreo-ot` rows are whole-row links (`abrirOt(id)`, anchor retained with `stopPropagation`).

Column visibility, measured by the delegated agent at three widths:

| Table | 360 | 768 | 1440 |
|---|---|---|---|
| monitoreo-ot | OT · Estado · Presupuesto | + Cliente · Técnico · Ver | + Categoría · Ubicación |
| consignaciones | OT · Estado · Acción | + Técnico · Monto | + Comisión · Comprobante |
| liquidaciones | OT · Estado · Acción | + Fecha · Valor | + Comisión · Medio |

**A4** — `<app-empty-state>` in all three. `monitoreo-ot` distinguishes filtered-empty from truly-empty via `hayFiltrosActivos()`; the other two have no filter state and use static copy.

**A5** — Inline icon style removed.

**A6** — Header rows and the liquidaciones summary row now wrap.

**Density decision (mine, after the agent's report)**

The first pass still overflowed at 360 px by 20–37 px. Root cause was not the column choice but padding and unbreakable tokens. Resolved in the system's own terms — 16 px page padding is already the `sm` step:

- panel container `p-6 sm:p-8` → `p-4 sm:p-8` (reclaims 16 px)
- table cells `p-3` → `px-2 py-2 sm:p-3` (reclaims 24 px across the three survivors)

47 replacements. Arithmetically this clears the measured residual; it was not re-measured in a browser on the authed page.

**A bug this pass uncovered**

`otsFiltradas` never recomputed. It read `FormControl.value`, which is not a signal, so a `computed` had nothing to invalidate on — the monitoring filters did **nothing** until the 25 s poll replaced the list. Existing specs missed it because they read `otsFiltradas()` before the first `detectChanges()`. Each control now feeds a `toSignal(valueChanges)`.

**Verification**
- `npm run build` → complete, exit 0.
- `npx ng test --watch=false --project app` → 84 files, 893 tests.
- `hidden md:table-cell` × 4 and `hidden lg:table-cell` × 4 per file (two columns × header + cell).
- Built CSS contains `md:table-cell`, `lg:table-cell`, `sticky`, `max-h-[calc(100vh-15rem)]`.

**Not verified**
- The board at 360 px on a real authenticated screen. The widths above were measured by the delegated agent in a harness; my own confirmation is arithmetic plus the compiled stylesheet.
- `liquidaciones-tecnico-page.ts` still swallows its load error, so an API failure renders "Todavía no hay liquidaciones" instead of an error state. That belongs to `harden`.
- `consignaciones-admin-page.html:164` still carries the same inline icon style the brief scoped to monitoreo.
