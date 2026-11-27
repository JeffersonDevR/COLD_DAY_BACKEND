# Surface brief — Web dashboard (COLD DAY)

Status: shaped, not implemented. Confirmed 2026-11-06.
Mode: **Operate**. Visual world: **Cold Dispatch** (Dark Ops), inherited from the mobile app.
Scope: `frontend/src` (Angular web app). Out of scope: `landing/`, mobile feature work, backend.

## 1. Job and audience

The dominant job is the **internal control tower**: an ADMINISTRADOR or CONTABLE sitting at a desktop mid-shift, with a dozen orders in flight, needing to answer *"what is stuck, since when, and who unblocks it?"* — then act, without leaving the screen.

Secondary, in order: the **técnico** working from a browser when the phone is unavailable; the **cliente** completing a request, a budget approval, or a payment; the **proveedor**, whose surface is a single narrow queue.

Everybody arrives already authenticated and mid-task. Nobody arrives to be delighted. The successful feeling is *"I can see the whole board and nothing is hiding from me."*

## 2. Outcome and proof

A screen succeeds when an operator can scan it and act on the exception. Concretely:

- The state of every live order is legible from a 150 cm viewing distance without hovering.
- "Stuck" is a visual category, not a filter the user must construct: an order without a technician for longer than expected, a budget awaiting client decision, a deposit awaiting reconciliation.
- Every row leads to the record that explains it, in one click, without losing the list position on return.
- Money always resolves: commission, parts, labor, settlement — an operator never has to ask "where does this number come from?"

Proof available today: the real lifecycle in `routes`, `estado-badge`'s canonical severity map, `admin-api`, `monitoreo-ot`, and the settlement model. No invented metrics are permitted — see PRODUCT.md *Evidence on Hand*.

## 3. Selected direction

**Visual authority:** the Dark Ops world already shipped in `frontend/projects/mobile/src/styles.css`, and the written flow rules in `docs/design/dark-ops/flujo-solicitud/README.md`. The mobile app is the proven expression; the web app is the one that drifted.

**Thesis:** the web app is the same instrument as the phone, mounted on a bigger console. Canvas `#0b1220`, surface `#111b2e`, hairlines instead of shadows, one cyan signal `#22d3ee` that means *interactive or live*. Space Grotesk for headings, Inter for text, Space Mono for anything an operator reads character by character — order codes, verification codes, amounts, coordinates.

**Focal moment:** the monitoring board. A dense, flat table where status is a coloured tag, a stalled order is visibly stalled, and the header stays with you while you scroll.

**Implementation consequence:** the light royal-blue/sky world and its 928 `dark:` variants are deleted, not restyled. PrimeNG's Aura preset is re-based onto the Dark Ops semantic tokens so components and hand-rolled markup stop disagreeing.

## 4. Scope and boundaries

**In scope**
- Global token layer: canvas/surface/border/text/accent scales, radius, type scale, control heights, motion.
- Shell: fixed topbar, collapsible sidebar, footer, page container.
- Shared primitives: badge, empty state, loader, load error, confirm dialog, toast host, timeline.
- The 41 page templates, migrated to tokens — including deleting every dead `dark:` variant.
- Data-dense patterns: tables, filters, bulk actions, pagination.

**Untouched**
- `landing/` keeps its light storefront identity.
- Mobile behaviour and routes; only token alignment where the web migration reveals a real contradiction.
- Backend contracts, business rules, role permissions.
- Feature scope. This is a visual and structural replacement, not a product expansion.

**Anti-goals**
- Do not "make it pop". This is an Operate surface; expression is spent on precision.
- Do not introduce a component library, a charting library, or an animation library.
- Do not rewrite copy wholesale. Copy changes are limited to text that currently blocks comprehension or lies about state.
- Do not preserve any element *because it already exists*.

## 5. States and ranges

| Dimension | Range that must work |
|---|---|
| Live orders on one screen | 0, 1, ~12 (typical), 200 (paged), 2000 (filtered) |
| Technicians in validation queue | 0, 5, 60 |
| Disputes open | 0, 3, 40 |
| Viewport | 360, 768, 1024, 1280, 1600 (max container), 2560 |
| Session states | loading, empty (with a next action), partial (some panels failed), error, unauthorized, expired session |
| Reduced motion | entire surface usable with animation disabled |

Every list needs: loading skeleton, empty state with a real next action, error state that names what failed and offers retry, and a "no results for these filters" state distinct from "nothing exists".

## 6. Interaction and layout

**Shell.** 64 px fixed topbar on `surface`, 1 px bottom hairline. Sidebar 256 px expanded / 64 px collapsed, on `surface` with `border`. Content container max 1600 px, page padding 16 / 24 / 32. Footer subordinate — never a second navigation.

**Hierarchy inside a page.** Page title + one primary action in the header row. Filters directly under the title. The board fills the rest. Secondary actions sit in the row or on the record, never floating above the fold.

**Tables.** Sticky header with sort affordance. Row height 40 px (32 px compact). Whole row is the link, not a trailing "ver" button. Status tag in a fixed column position so the eye learns one scan path. Column priority: identity + status + age + amount always visible; tertiary columns drop below `lg` rather than triggering horizontal scroll on a phone.

**Bulk selection.** Only where an operator genuinely acts in batches (validation, reconciliation, dispute triage). Selecting shows a sticky action bar anchored to the bottom of the content area, with the count and the actions — and the selection survives pagination within the current filter.

**Filters.** Always visible, never hidden behind a modal. One reset. Active filters are legible as chips, not as a silent query string.

**Feedback.** Actions confirm in place or by toast, never by alert. A failed mutation keeps the user's input. Destructive actions confirm with the record's identity in the sentence, not with "¿Estás seguro?".

## 7. Constraints and open decisions

**Binding**
- Angular 21 standalone components, signals, OnPush.
- Tailwind CSS v4 with the token aliases in `frontend/src/styles.css`; PrimeNG 21 Aura preset re-based on the same semantic values.
- WCAG 2.1 AA; keyboard operable; accessible names on every icon-only control.
- `es-CO` locale, tuteo, Colombian pesos.
- No new runtime dependency.

**Open, must not be invented by a builder**
- Whether the topbar keeps the user menu as a popup menu or becomes an inline identity block.
- Whether the monitoring board's default sort is by age or by status severity.
- Whether the client and technician surfaces stay inside the same shell as the admin tower.

**Sequencing after this brief.** `document` (this session) → `typeset` → `clarify` → `adapt` → `audit` → `harden` → `polish`.
