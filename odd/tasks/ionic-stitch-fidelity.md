# Ionic Mobile App vs Stitch "Dark Ops" — Design Fidelity Audit

- **Date:** 2026-11-03
- **Scope:** `projects/mobile/src/app/**` in worktree `t2-verify-6b9f3d8` (branch `feat/ionic-p2-ot`), plus `styles.css`, `index.html`, `angular.json` (mobile project), `main.ts`, `capacitor.config.ts`, `app.config.ts`, tab shell (`pages/modo-tabs`), and the `@core` helpers the screens consume (`ots-cliente.ts`, `estado-ot.ts`).
- **Ground truth:** Stitch exports in `stitch-audit/A1-login.html`, `A2-registro.html`, `A3-cuenta.html`, `A4-panel-cliente.html`, `A5-solicitar.html` (read in full; all line refs below are to those files).
- **Method:** static code audit. No build, no tests, no render. Every "effective value" claim below is derived from the CSS cascade, Angular/Ionic source, or the templates — not from a screenshot. See **Could not verify**.
- **Tree caveat:** a writer session is active in this worktree. `panel-cliente.page.ts`, `mobile-error.interceptor.ts` and `google-maps-loader.ts` were modified **during** this audit; line numbers reflect the files as read on 2026-11-03. The Panel section documents the current (post-edit) state, which added a "Ver seguimiento" button.

## Verdict per screen

| Screen | Verdict | One-line reason |
|---|---|---|
| A1 — Ingreso (login) | **OFF-BRAND** | Canvas renders `#121212` (Ionic `dark.always.css` wins over `styles.css`), Material-uppercase 36 px button, no card, no top/bottom chrome, no cyan glow. |
| A2 — Registro | **OFF-BRAND** | Same cascade bug + no status/header chrome, no card around the form, no leading input icons, no error-tinted inputs, uppercase 36 px CTA. |
| A3 — Mi cuenta / modo selector | **OFF-BRAND** | Identity card reduced to two text lines; no avatar, no VERIFICADO pill, no mode cards with icons/stats/glow, no "Agregar perfil", no fixed confirm CTA, tab shell ≠ Stitch nav. |
| A4 — Panel cliente | **OFF-BRAND** | No logo/CLIENTE pill/bell, no metric tiles with amber warning variant, segmented control is Material caps-underline (not pill chips), OT cards missing icon tiles & chevrons (unregistered icons render blank), no fixed glow CTA, no center Urgente FAB. |
| A5 — Solicitar (paso 1) | **OFF-BRAND** | Entire map/bottom-sheet experience absent (documented as P3); category tiles use unregistered ionicons (blank); no PASO pills, no address-confirm card, no location chips, CTA not the Stitch glow slab. |
| Tab shell (`modo-tabs`) | **OFF-BRAND** | 56 px Ionic md bar (Stitch: 64 px), unselected icons `*-outline` vs Stitch filled/outlined Material mix, labels not uppercase/mono/tracked, bar renders `#1f1f1f` (cascade), no center Urgente FAB. |

> If the two root-cause fixes (RC-1, RC-2) land, A1/A2 move toward **CLOSE**; A3/A4/A5 still need structural work (missing components), so they stay **OFF-BRAND**.

---

## A1 — Ingreso (`pages/login/login.page.ts`, `styles.css` `.cd-auth*`)

| Severity | Area | Stitch reference (element → computed) | App implementation (property → effective) | Fix |
|---|---|---|---|---|
| BLOCKER | Canvas color | body `bg-[#0b1220]` (A1 L48) flat | `ion-content.cd-auth` → `--background: var(--ion-background-color)` → **`#121212`** (Ionic `dark.always.css` `:root.md` specificity 0,2,0 beats `styles.css:17` `:root` 0,1,0). Whole app affected, this screen included. | Fix RC-1 (scope overrides to `:root.md`). `frontend/projects/mobile/src/styles.css` |
| MAJOR | Background treatment | Flat `#0b1220`; no gradient anywhere | `.cd-auth { --background: radial-gradient(120% 80% at 50% 0%, #12334a 0%, …) }` (`styles.css:110-112`) — invented token, teal-glow halo not in Stitch | Delete the gradient; use flat `--ion-background-color`. `styles.css:110-112` |
| MAJOR | Form chrome | Form wrapped in `bg-[#111b2e] border border-[#1e293b] rounded-xl p-5 shadow-2xl` (L69) | `<form class="cd-auth__form">` — transparent, no card, no padding, `gap: .5rem` (`styles.css:161-164`), content floats on gradient | Wrap in `.cd-card`-style panel (`background: var(--cd-surface); border: 1px solid var(--cd-surface-border); border-radius: var(--cd-radius-card); padding: 1.25rem`). `login.page.ts:60`, `styles.css` |
| MAJOR | Primary button | `h-12` (48 px) `bg-[#22d3ee]` `rounded-lg` (8 px) `shadow-[0_0_20px_rgba(34,211,238,0.25)]` `font-headline font-semibold text-sm` **normal case** `active:scale-[0.99]` (L94) | `ion-button expand="block"` md defaults: `min-height: 36px`, `text-transform: uppercase`, `font-size: .875rem`, `letter-spacing: .06em`, `margin-inline: 2px`, Material elevation `--box-shadow: 0 3px 1px -2px rgba(0,0,0,.2)…` (not cyan glow). App overrides only `--border-radius: 8px` (`styles.css:67-70`) | Fix RC-3 (CTA recipe): `min-height: 48px; text-transform: none; letter-spacing: 0; --box-shadow: 0 0 20px rgba(34,211,238,.25)` on a `.cd-cta` class. `styles.css`, `login.page.ts:98-109` |
| MAJOR | Top chrome | Header row: back button (`arrow_back`, 44 px hit area, `rounded-lg`, `active:bg-[#111b2e]`) + `SISTEMA ACTIVO` pill (dot `animate-pulse`, `font-mono text-[11px] tracking-wider uppercase text-slate-400`, `bg-[#111b2e] border-[#1e293b] rounded-full`) + `shield` icon in slate-600 (L49-60) | Nothing. Screen starts directly with centered logo block (`login.page.ts:47-58`) | Add the header row or drop it from design; do not ship half a chrome. `login.page.ts` |
| MAJOR | Bottom chrome / footer | Footer: `lock` icon 14 px + `Conexión cifrada de extremo a extremo · Argentina` `font-mono text-[11px] tracking-wide text-slate-500`, `safe-bottom` padding (L113-118) | Nothing. (Also: app copy must not say "Argentina" — see Copy & locale drift.) | Add equivalent footer with `env(safe-area-inset-bottom)` padding. `login.page.ts`, `styles.css` |
| MAJOR | Input styling | `h-12` (48 px), `bg-[#0b1220]`, `border border-[#1e293b]`, `rounded-lg`, `px-3.5`, `text-sm`, `focus:border-[#22d3ee] focus:ring-1 focus:ring-[#22d3ee]`, `placeholder-slate-600`; **labels** `font-mono text-[11px] tracking-wider uppercase text-slate-400` (L72-84) | `ion-item`/`ion-input` stacked label: label renders in `--ion-font-family` (Inter) normal case, item background effectively **`#1e1e1e`** (RC-1), md `min-height: 48px` (ok), no focus ring (Ionic md shows no cyan focus outline), no `px-3.5`, no placeholder shown | Fix RC-1; set label font/tracking/uppercase (`--highlight-height`? better: project label styles or use custom field). `styles.css:307-311`, `login.page.ts:62-82` |
| MAJOR | Password visibility | Icon button `visibility`, 44 × 48 hit area, absolute right, `text-slate-400 hover:text-white` (L85-88) | Text button "Mostrar contraseña"/"Ocultar contraseña", `font-size: .8rem`, cyan, right-aligned (`styles.css:166-174`, `login.page.ts:85-92`) | Swap to icon toggle (`eye-outline`/`eye-off-outline`, registered) with `aria-label`, keep 44 px hit area. |
| MINOR | Layout width | `max-w-[390px] mx-auto` (L49) | `.cd-auth__inner { max-width: 26rem }` = **416 px** (`styles.css:120`) | `max-width: 390px` (or `24.375rem`). `styles.css:120` |
| MINOR | Safe area | `.safe-top { padding-top: env(safe-area-inset-top, 16px) }`, `.safe-bottom` (L44-45) | `env(safe-area-inset-top)`/`bottom` used **without fallback**, and no extra +6/+10 px offset like A2/A3 (`styles.css:123-124`); `[fullscreen]="true"` on ion-content ok | Add fallbacks: `env(safe-area-inset-top, 16px)`. `styles.css:123-124` |
| MINOR | Logo artwork | `<img>` Snowflake logo (aida asset), 64 px, `rounded-xl bg-[#111b2e] border border-[#1e293b] p-2 shadow-lg` (L63-65) | Inline SVG snowflake, `64px`, `rounded: 18px`, `rgba(34,211,238,.08)` bg + `.35` cyan border + `0 0 32px` glow (`styles.css:134-143`) — close concept, different radius/border/glow, no external asset (good) | Either import the Stitch asset (license permitting) or accept SVG and match radius to `xl` (12 px) + `border-[#1e293b]`. |
| MINOR | Wordmark / tagline | `COLD DAY` Grotesk 700 `uppercase tracking-widest text-2xl text-white`; tagline `Servicio técnico oficial a domicilio` `text-xs text-slate-400` (L66-67) | `.cd-wordmark` Grotesk 600, `letter-spacing: .22em`, 1.5 rem, renders "COLD DAY" via `text-transform` (ok); tagline `Operaciones en frío, en tiempo real.` `.88rem` (`login.page.ts:56-57`, `styles.css:145-159`) | Copy mismatch only (see Copy & locale drift). Weight: Stitch 700 vs app 600. |
| MINOR | Error banner | `bg-[#f87171]/10 border-[#f87171]/25 rounded-lg py-2.5 px-3` + `error` icon 18 px + `text-xs #f87171 font-medium` (L90-93) | `.cd-auth__error` `rgba(248,113,113,.12)` bg / `.35` border / radius 8 px / text `#fecaca`, **no leading icon** (`styles.css:176-184`, `login.page.ts:94-96`) | Add icon slot or accept; align text to `#f87171`-on-tint for Stitch parity. |
| NIT | Focus ring | `focus:ring-1 focus:ring-[#22d3ee]` on inputs; visible cyan outline | No `:focus-visible` treatment anywhere in app styles | Add `ion-input:focus-within` ring or outline on `.cd-form ion-item`. |
| NIT | Selection color | `selection:bg-[#22d3ee]/20 selection:text-[#22d3ee]` (L48) | None | Add `::selection` rule. |

**A1 notes.** Stitch pre-fills mock values and shows a live error banner; the app's error state exists and is honest (good), but the banner is below the fields instead of where Stitch places it (above CTA — same). Disabled CTA before validity is good but renders with Ionic default disabled opacity (see RC-3). Safe-area: **partial** (auth wrapper only).

## A2 — Registro (`pages/registro/registro.page.ts`)

| Severity | Area | Stitch reference | App implementation | Fix |
|---|---|---|---|---|
| BLOCKER | Canvas | `body bg-[#050911]`, main frame `bg-[#0b1220]` (A2 L55-73) | Inherits RC-1 → **`#121212`** everywhere | RC-1 fix. |
| BLOCKER | Status/header chrome | Fake status row (`09:41`, `signal_cellular_alt`, `wifi`, `battery_full`, `font-label text-[11px] text-text-dim`) + header: back `arrow_back_ios_new` 44 px, title `Crear cuenta` Grotesk 700 `text-base`, `verified_user` icon `text-text-dim/80`, `backdrop-blur-md bg-canvas/95 border-b` (L74-94) | Nothing. `<header class="cd-auth__brand">` shows centered logo + "Cold Day" + tagline; no back nav, no title row | Decide: native status bar is fine (drop fake row), but the header row (back + centered title + secure-channel icon) is required for parity. |
| MAJOR | "OPS" brand row + phase chip | Row: 24 px `ac_unit` tile in `bg-surface` + `COLD DAY · OPS AR` `font-headline text-xs font-bold tracking-wider uppercase text-text-dim`; right: `FASE REGISTRO` chip `font-label text-[10px] bg-surface border-outline-dim rounded` (L96-105) | Missing entirely | Add row; **localize copy** (`OPS CO` / `FASE REGISTRO`) per market, not delete. |
| MAJOR | Role segmented control | `bg-surface p-1 rounded-xl border grid grid-cols-3 gap-1`; active button: `bg-outline-dim` (`#1e293b`), `text-primary` (`#22d3ee`), `border border-primary/30`; sub-caption `font-label text-[9px] uppercase tracking-wider text-primary/80` (L106-119) | `.cd-segment` `background: #0e1828` (off-token), radius 8 px; active: `rgba(34,211,238,.12)` bg + `rgba(34,211,238,.45)` border + **white** text (`--ion-text-color` → `#ffffff` via RC-1, even without it `#e2e8f0` — Stitch active text is cyan); sub-caption `.62rem` Inter not mono (`styles.css:206-242`, `registro.page.ts:156-170`) | Active: `color: var(--ion-color-primary); background: var(--ion-color-primary-shade?)` — use `#1e293b` bg + cyan text + `rgba(34,211,238,.3)` border; caption Space Mono 9 px. |
| MAJOR | Form card | `<form class="bg-surface border border-outline-dim rounded-xl p-3.5 space-y-3 shadow-sm">` (L121) | No card; fields stack on background; sections use `.cd-section` only for role blocks (`styles.css:244-251` — bg `rgba(17,28,46,.6)`) | Give the whole form the Stitch card treatment (surface, 12 px radius, 14 px padding). |
| MAJOR | Field labels | `font-label text-[11px] uppercase tracking-wider text-text-dim` (L123, L149, L162) | Ionic stacked label — Inter, normal case, md label size (~12-14 px), color `--ion-text-color` (`#ffffff` effective) | Register Space Mono + set label custom properties or custom field component. |
| MAJOR | Leading/trailing input icons | Every input has leading `material-symbols-outlined` (`badge`, `mail`, `lock`, `location_on`) `absolute left-2.5 text-text-dim text-base`; error field gets trailing `error` icon; password gets trailing 44 px `visibility` button (L126-170) | **Zero** icons in inputs (verified `registro.page.ts:174-243`) | Add leading icon slots; register `badge-outline`, `mail-outline`, `lock-closed-outline`, `location-outline`, `eye-outline` in `main.ts` (see RC-4). |
| MAJOR | Error field state | `aria-invalid="true"`, `bg-danger-muted/30 border-danger` (`#f87171`), label turns `text-danger`, helper `Ingresá un correo válido con dominio activo.` with `warning` icon, `text-xs` (L131-147) | Only `.cd-field-error` text `#fca5a5` under the field; item border unchanged (`rgba(226,232,240,.08)`); no `aria-invalid` (`registro.page.ts:198-200`, `styles.css:199-203`) | Add `cd-item--invalid` class binding: red border + `rgba(248,113,113,.12)` bg + `aria-invalid`. |
| MAJOR | Address field affordance | Label row split: `Dirección de Casa` + right chip `CABA / AMBA` `font-label text-[9px] text-primary uppercase`; leading icon cyan (`location_on` `text-primary`) (L160-170) | Plain stacked "Calle y número" / "Ciudad" inputs; no prefix chip (`registro.page.ts:272-296`) | Add the right-aligned meta chip (copy: `CO · CÚCUTA` per market) and cyan leading icon. |
| MAJOR | Legal / privacy block | `shield` icon + `font-label text-[10px] leading-relaxed tracking-tight text-text-dim`: "Tus datos están protegidos · Encriptación TLS 1.3 con almacenamiento bajo normativa AR-PDP." (L172-177) | `ion-checkbox.cd-legal` with longer Habeas Data copy (Ley 1581, **Colombia**) — correct market, but no leading `shield` icon, checkbox renders Ionic md default, copy is a legal paragraph not the TLS one-liner; `font-size: .75rem` (`registro.page.ts:383-394`, `styles.css:290-300`) | Add icon+caption row above checkbox; keep local law copy (it is the honest local equivalent). |
| MAJOR | CTA | `h-12` `bg-primary` `text-on-primary` (`#042f2e`) `font-headline font-bold text-sm tracking-wide rounded-xl` (12 px!) `shadow-cyan-glow` (`0 0 16px -2px rgba(34,211,238,.45)`) `active:scale-[0.99]` + trailing `arrow_forward` icon (L181-184) | `ion-button expand="block"` — 36 px min-height, uppercase, Material elevation, 8 px radius, no glow, no arrow icon, label "Crear cuenta" (case preserved? No — forced UPPERCASE by md) (`registro.page.ts:408-419`) | RC-3; radius **12 px** for this CTA per Stitch; add `arrow-forward-outline` (register icon). |
| MAJOR | Footer | Sticky footer `bg-canvas/95 backdrop-blur-md border-t`: CTA + `¿Ya tenés cuenta en Cold Day?` + `Ingresá` (cyan, underline-offset-2) link + 128 × 4 px home-indicator bar (`bg-outline-dim rounded-full opacity-70`) + `pb-[calc(env(safe-area-inset-bottom,12px)+10px)]` (L180-190) | No footer; link inline in flow (`registro.page.ts:422-425`); CTA scrolls away with content; safe-area only on `.cd-auth__inner` | Restructure auth pages to `<ion-footer>` with safe-area padding; keep rotating link copy. |
| MINOR | Note under role chip | A2 body `min-height: max(884px, 100dvh)`, fixed 844 px frame on desktop (L69-73) | Full-bleed responsive (correct for real device); no 390 canvas (see shell notes) | Keep responsive; do not ship the fixed frame. |
| MINOR | `on-primary` contrast | `#042f2e` on `#22d3ee` (A2) and `#0b1220` on `#22d3ee` (A1/A3/A4/A5) — Stitch itself is inconsistent | `--ion-color-primary-contrast: #04121a` (`styles.css:28`) — close to A2's value; fine | Normalize Stitch reference to one value; keep app `#04121a`. |
| MINOR | Toast on success | n/a | `color="success"` → Ionic `#2dd55b` (default, unmodified — RC-5) | RC-5. |

**A2 notes.** Stitch shows "Revisá el dato" microcopy + danger label tint — app has the equivalent (`mensajeCampo`) and file-level honesty (good), but the field itself never goes red. Segmented control `aria-pressed` is correct; keep. **Safe-area: partial** (auth wrapper; no footer PT).

## A3 — Mi cuenta (`pages/cuenta/cuenta.page.ts`)

| Severity | Area | Stitch reference | App implementation | Fix |
|---|---|---|---|---|
| BLOCKER | Canvas | `bg-[#0b1220]` (A3 L55) | RC-1 → `#121212`; plus plain `<ion-header>` with **no** `cd-header` safe-area padding → content can sit under status bar if overlay is enabled (capacitor has no StatusBar config — unverified) | RC-1; add safe-area top to plain headers globally (`ion-header ion-toolbar` padding or use `cd-header`). |
| MAJOR | Identity card | `bg-[#111b2e] border rounded-xl p-4 flex justify-between`: 52 px avatar `rounded-full p-0.5 bg-gradient-to-tr from-[#22d3ee] to-[#1e293b]`, green `bg-[#22c55e]` presence dot `border-2 border-[#111b2e]`, name Grotesk 700 white, sub `CUENTA ACTIVA · CABA` `font-label text-[11px] uppercase tracking-wider text-[#22d3ee] font-semibold`, email `text-xs text-slate-400`, trailing 36 px `edit` button `rounded-lg bg-[#0b1220]/60 border` (A3 L85-104) | `.cd-card`: eyebrow "Cuenta" + `cd-headline` name + muted email — **no avatar, no gradient ring, no presence dot, no VERIFICADO sub-line, no edit button** (`cuenta.page.ts:38-42`) | Rebuild card to Stitch spec; presence dot color `#22c55e` (currently unused anywhere in app). |
| MAJOR | Verified pill | Header right: `verified_user` 13 px + `VERIFICADO` `font-label text-[11px] font-semibold text-[#22d3ee]` `rounded-full bg-[#111b2e] border-[#1e293b] px-2.5 py-1` (L74-77) | Missing (plain toolbar + title only) | Add pill (and `Ajustes` gear button if settings exists on web; otherwise omit deliberately). |
| MAJOR | Helper banner | `bg-[#111b2e]/40 p-3 rounded-lg border-[#1e293b]/60` + `swap_horiz` cyan 16 px + "El mismo usuario puede actuar como cliente y como técnico; elegí con qué modo abrir la app." `text-[13px] text-slate-300` (L105-112) | `.cd-muted` paragraph — no icon, no tinted container, copy differs ("Elegí con qué perfil querés usar Cold Day. Podés cambiarlo cuando quieras.") (`cuenta.page.ts:46-48`) | Restyle to Stitch banner with `swap-horizontal-outline` icon (register it). |
| MAJOR | Mode cards | Three `article` cards `rounded-xl p-4`; **active** = `border-2 border-[#22d3ee]` + `shadow-[0_0_16px_rgba(34,211,238,0.12)]`, icon tile `w-10 h-10 rounded-lg bg-[#22d3ee]/10 text-[#22d3ee] border-[#22d3ee]/30` with `home_repair_service`/`engineering`/`inventory_2` (Material Symbols), title row + `En uso` pill (pulsing dot, `bg-[#22d3ee]/15 border-[#22d3ee]/30`) or `Matrícula #4829`/`Repuestos` slate pill; description `text-[13px]`; footer `border-t` row: green dot + "2 solicitudes activas en CABA" + cyan `Predeterminado` / star `4.92 (38 servicios)` + `Usar este modo` button `min-h-[44px] px-4 rounded-lg border bg-[#0b1220]/50`; Proveedor row shows violet `storefront` icon "Catálogo sincronizado" (A3 L113-207) | Three `.cd-modo` rows: flat `#0e1828`, 8 px radius, `border 1px`, **no icons, no stats, no badges, no description copy**, active = cyan border + cyan name text + trailing `checkmark-circle-outline`; disabled = `opacity: .65` + "Tu cuenta no tiene este perfil" (`cuenta.page.ts:50-68`, `styles.css:313-356`) | Full rebuild to Stitch spec (keep the app's honest disabled-with-explanation pattern — it's better than hiding). Map icons: `home-outline` (have), `construct-outline`/`build-outline` (have construct), `cube-outline` (have). |
| MAJOR | "AGREGAR PERFIL" section | `text-[11px] font-label uppercase tracking-widest` heading + two 48 px rows: `add` in 32 px tile, label `text-[13px] font-semibold`, trailing `chevron_right`; tecnico row carries amber `REQUIERE MATRÍCULA` pill (`#f59e0b` on `/15` tint, `border-[#f59e0b]/30`) (A3 L208-239) | **Entire section missing** | Add section; register `add-outline`, `chevron-forward-outline`. |
| MAJOR | Fixed confirm CTA | `fixed bottom-16` bar `bg-[#0b1220]/95 backdrop-blur-md border-t`: full-width `h-12 rounded-xl bg-[#22d3ee]` + `check_circle` filled 20 px + "Confirmar modo activo", glow `0_0_20px_rgba(34,211,238,0.25)` (A3 L241-246) | None — mode switches apply immediately on tap with no confirmation surface | Decide interaction: immediate switch + toast (current) vs confirm CTA (Stitch). If parity wanted, add the fixed bar above the tab bar. |
| MAJOR | Bottom nav | 4 tabs `build` Servicios · `assignment` Solicitudes · `engineering` Técnicos · `person` Perfil (active, **FILL 1**, cyan); labels `font-label text-[10px] uppercase tracking-wider`; active `font-bold text-[#22d3ee]`; bar `h-16 bg-surface/95 backdrop-blur-md border-t`; home indicator `w-32 h-1 bg-slate-500/40` (A3 L247-267) | CLIENTE shell: Panel `home-outline` · Equipos `cube-outline` · Cuenta `person-outline` — **3 tabs, no Urgente/Servicios/Solicitudes parity, icons never filled for active state, labels not uppercase mono** (`modo.ts:33-38`, `modo-tabs.page.ts:24-33`) | Fix RC-6 (tab bar). Reconsider 4-tab layout to match Stitch IA or document deviation. |
| MAJOR | Sign-out | Stitch shows none on this screen (by omission) | `ion-button fill="outline" color="danger"` → Ionic danger `#f24c58` (unmodified, RC-5), full-width | Keep sign-out (app need > Stitch omission) but set `--color: #f87171` / override danger. |
| MINOR | Header layout | `h-14 px-4`, back button `w-10 h-10 rounded-full`, title Grotesk 700 `text-lg tracking-tight`; 44 px touch targets | `ion-toolbar` default height (~56 px md) + `ion-title` default (`--color` → `#fff`); no back button (page is a tab root) — acceptable for tab root | If used as pushed route, add back; tint title via `--color`. |
| MINOR | Copy locale | Spanish (AR) copy throughout | Same voseo copy, es-CO numerals — fine | — |

**A3 notes.** The app deliberately replaces Stitch's "confirm" model with instant switch + toast; document this as a **product decision**, not silent drift. Presence/stats (`4.92 · 38 servicios`, `2 solicitudes activas`) have no backend feed — do not fake them; either wire real data or drop those rows. **Safe-area: none** on this page (plain header, no fallback).

## A4 — Panel cliente (`pages/panel-cliente/panel-cliente.page.ts`)

| Severity | Area | Stitch reference | App implementation | Fix |
|---|---|---|---|---|
| BLOCKER | Canvas | `bg-canvas` = `#0b1220` (A4 L51-52) | RC-1 → `#121212` | RC-1. |
| MAJOR | App bar identity | 28 px logo tile (border `primary/30`) + "Hola, Martín" Grotesk 700 `text-sm` + caption `PANEL DE OPERACIONES` `font-mono text-[11px] tracking-wider text-slate-400`; right: `CLIENTE` pill (`text-[10px] font-mono font-bold text-primary border-primary/40 bg-primary-dim rounded-full uppercase`) + 36 px bell `rounded-lg border-border-line bg-surface` with **amber dot** `ring-2 ring-surface shadow-glow-amber` (A4 L53-73) | `cd-header` → toolbar with eyebrow "Panel del cliente" + h1 "Hola, {nombre}" + paragraph + two small buttons ("Pedir un técnico", "Historial") (`panel-cliente.page.ts:70-97`). **No logo, no CLIENTE pill, no bell, no caption** | Add the identity row; the Stitch caption should be localized (`PANEL DE OPERACIONES` ok in es-CO). Bell only if notifications exist — otherwise omit deliberately. |
| MAJOR | Pull-to-refresh affordance | Dedicated hint bar under header: `south` icon `animate-pulse` cyan + "Deslizá para actualizar estado" `text-[11px] font-mono text-slate-400`, `bg-surface/50 border-b` (A4 L75-78) | `ion-refresher` with `pullingText="Deslizá para actualizar"` — Ionic default spinner styling, no hint bar; only visible while pulling (`panel-cliente.page.ts:100-106`) | Either keep refresher (better UX) and drop the Stitch bar, or render the static hint bar above content; pick one. |
| MAJOR | Metric tiles | 3 tiles `rounded-lg` (8 px ✓) `p-2.5 border-border-line`: values Grotesk 700 `text-xl`, **tile 3 amber** (`text-amber` = `#f59e0b`, "SIN TÉCNICO"), labels `font-mono text-[10px] tracking-wider uppercase text-slate-400` (A4 L80-93) | 3 tiles ok radius but: all values render **cyan** (`.cd-metrica__valor` hard-codes `--ion-color-primary`, `styles.css:416-421`); 3rd tile is "90 días / Garantía certificada" (not a counter, no amber variant); padding `.75rem .6rem`; labels `.65rem` not mono (`panel-cliente.page.ts:139-154`, `styles.css:399-427`) | Add `cd-metrica--alerta` variant (`color: var(--ion-color-secondary)`) and bind amber to the "sin técnico"/warning metric; use real counter (`sinTecnico`) — it exists in `OPCIONES_FILTRO_OTS`/filters, just not surfaced as a tile. |
| MAJOR | Filter chips | Individual pill buttons `rounded-md px-3 py-1.5 font-mono text-[11px]`; active = `text-primary bg-primary-dim border-primary/50 font-bold`; inactive = `text-slate-400 bg-surface border-border-line` (A4 L94-107) | `ion-segment.cd-filtros` md = **uppercase 14 px text buttons with bottom indicator**, `min-height: 48px`, `--background: #0e1828` custom (`styles.css:429-434`) — completely different geometry & type; labels forced `uppercase` by md | Replace with Stitch pill-chip row (buttons) or override segment-button (`text-transform: none; min-height: 40px` + pill styling) — pills match Stitch, segment look does not. |
| MAJOR | "Servicios Recientes" header | Row: `Servidores Recientes` Grotesk 700 `text-sm text-slate-200` left; right `font-mono text-[11px] text-slate-500` "3 de 8 totales" (A4 L108-111) | `cd-panel__sub` subtitle line (`Trazabilidad en tiempo real…`) — no count, different purpose (`panel-cliente.page.ts:170`) | Add count line `font-mono` (`ui-monospace` acceptable until Space Mono is loaded). |
| MAJOR | OT card — icon tile | `w-9 h-9 rounded-lg bg-surface-subtle (#162238) border border-border-line` tile with colored Material Symbol: `kitchen` (amber) / `ac_unit` (cyan) / `local_laundry_service` (success `#22c55e`) (A4 L113-176) | **No icon tile at all** — cards start with code chip + status chip (`panel-cliente.page.ts:183-218`); `#162238` token absent from app | Add tile + per-category icon map (`snow-outline`/`thermometer-outline`/`water-outline`…), register icons (RC-4). |
| MAJOR | OT card — status badge shape | `rounded` (**4 px**), `text-[10px] font-mono font-bold tracking-wider`, tinted border/bg 10-12 % per tone, `uppercase` (A4 L124-126, L144-146, L167-169) | `.cd-chip` is **`border-radius: 999px` pill** (`styles.css:267-275`) — wrong shape vs Stitch badges; colors close but off (`#fcd34d` espera, `#6ee7b7` ok, `#fca5a5` cerrada — see Color tokens table) | Add `--cd-radius-badge: 4px` variant or set `.cd-chip--badge`; align tints to `#f59e0b` / `#22c55e` / `#f87171` families. |
| MAJOR | OT card — footer | Left: mono `#CD-8842 · CABA`-style meta line `text-[11px] text-slate-400` with `<strong class="text-slate-200">$42.000</strong>`; optional pulsing dot + "Técnico Lucas V. llega en 15 min"; right: `chevron_right` Slate-500 18 px (or `receipt_long` for finalized) (A4 L128-131, L148-154, L171-174) | Footer: location icon (unregistered → **blank**) + `barrio || direccion` + right-aligned `date:'shortTime'`; new "Ver seguimiento" clear button with **unregistered** `chevron-forward-outline` (blank) (`panel-cliente.page.ts:195-214`) | Register icons; format fecha like Stitch (`dd MMM`); consider chevron-only row matching Stitch density. |
| MAJOR | Fixed bottom CTA | `fixed bottom-16` full-width `h-[50px] bg-primary text-canvas` + `add` filled 20 px + "Nueva solicitud de service" Grotesk 700 `text-sm tracking-wide` `rounded-xl` `shadow-glow-cyan` + `active:scale-95` over `bg-gradient-to-t from-canvas via-canvas/90 to-transparent` (A4 L193-198) | **Missing.** Only an in-hero small `ion-button` "Pedir un técnico" (`panel-cliente.page.ts:80-83`) | Add fixed CTA above tab bar (respect `env(safe-area-inset-bottom)` + 56 px tab bar offset) or make in-hero CTA the documented deviation. |
| MAJOR | Center Urgente FAB | Nav center cell: `-mt-5` 44 px circle `bg-surface border-2 border-primary text-primary` + `bolt` filled 22 px, `shadow-glow-cyan-sm`; caption "Urgente" `text-[9px] font-label uppercase text-primary font-bold` (A4 L208-213) | **Missing entirely**; CLIENTE shell has Panel/Equipos/Cuenta only | Product decision needed: add Urgente slot to CLIENTE tabs (5 items) or drop from design; cannot silently omit. |
| MAJOR | Diagnostic CTA card | Dashed-border `rounded-xl bg-surface/60 p-3.5`: "Contá tu próximo service" + sub + violet `build_circle` tile + full-width `speed` + "Diagnóstico rápido" button `rounded-lg border-border-line bg-surface` (A4 L177-191) | **Missing** | Add block or document as descoped (P2/P3). |
| MINOR | Section label | "Servicios Recientes" Grotesk 700 `text-sm tracking-tight text-slate-200` | `cd-panel__sub` is Inter `.78rem` muted — no heading element (`panel-cliente.page.ts:170`) | Use `.cd-headline`-style `text-sm` heading. |
| MINOR | Ticket code font | `font-mono text-[11px] text-slate-400` (`#CD-8842 · CABA`) | `.cd-ot__codigo` `ui-monospace` 700 `.72rem` `--cd-muted` (`styles.css:453-458`) — right idea, wrong family until Space Mono loads | Load Space Mono (RC-2). |
| MINOR | Card interaction | `active:bg-surface-subtle transition-all cursor-pointer` + whole card clickable | Cards not clickable as a whole; explicit "Ver seguimiento" button (new, un-styled wrapper `.cd-ot__acciones` has **no CSS rule** — renders as plain block) | Wire card click → seguimiento; style or remove wrapper. |
| MINOR | OT meta line | `12 Oct · Cotización preliminar: $42.000` | Date only (`date:'shortTime'`) — no price preview (data may not exist; fine) | Keep date; add price when DTO exposes it. |

**A4 notes.** App error/empty/loading states are genuinely better than Stitch mocks (error + retry, honest empty) — **keep them**, style them to token. Pull-to-refresh exists (Stitch only hints it). **Safe-area: partial** (`cd-header` top padding only).

## A5 — Solicitar servicio (`pages/solicitar-servicio/solicitar-servicio.page.ts`)

| Severity | Area | Stitch reference | App implementation | Fix |
|---|---|---|---|---|
| BLOCKER | Map / step-1 canvas | Full-bleed SVG dark map (`#0b1220` base, `#0e1726` blocks, `#1e293b` hairlines, `#24344d` arterials), `mapVignette` radial (`#111b2e`→`#0b1220`), street labels Space Mono 7-8 px `#475569`/`#334155` (A5 L53-115) | **No map at all** — plain scrolling form. (Documented in component header: "No hay mapa interactivo… llega en P3 con mapas nativos.") | Accept as **descoped (P3)** or implement with Google Maps dark styling; do not fake with a static image unless approved. |
| MAJOR | Pin / pulse visual | Center pin: `w-28 h-28 pulse-ring` (`scale .6→2.4`, 2.5 s, `cubic-bezier(.215,.61,.355,1)`), dashed `w-7 h-7` ring, crosshair hairlines, `ac_unit` **FILL 1** in `w-10 h-10 rounded-full bg-surface border-2 border-primaryCyan`, drop-shadow cyan, tail caret + blurred base ellipse (A5 L96-110) | None | P3 scope; if placeholder needed, static pin SVG only. |
| MAJOR | Header overlay | `pt-12 px-4` floating: 44 px back `rounded-xl bg-surface/90 backdrop-blur-md border` + right `rounded-full` chip `PASO 1 / 3` (`font-label text-[11px] font-bold tracking-wider`, cyan dot) (A5 L117-126) | Standard `ion-header` + `ion-back-button` (md default icon/styling) + `ion-title` "Solicitar servicio" — **no PASO pill** (`solicitar-servicio.page.ts:92-99`) | Add `PASO 1/3` chip if 3-step wizard is the final IA; style back button to Stitch spec (44 px, `rounded-xl`, translucent). |
| MAJOR | Floating search bar | `h-12 rounded-xl bg-surface/95 backdrop-blur-md border px-3.5`: leading `search` 20 px slate-400, input `text-[13.5px] placeholder-slate-500`, trailing 32 px GPS button (`near_me` 19 px → cyan on hover), `focus-within:border-primaryCyan/70`, `value="Av. Cabildo 2450, CABA"` (A5 L127-134) | Plain labeled `ion-input` "Dirección exacta" inside `.cd-bloque` (`solicitar-servicio.page.ts:249-264`); separate outline buttons "Ubicar dirección" (`search-outline`) and "Usar mi ubicación" (`navigate-outline`, `color="tertiary"` violet) below (`:264-294`) — **icons unregistered → blank** | Consolidate into the floating-search pattern or keep form layout but register icons + restyle buttons. |
| MAJOR | PASO caption + category chip | Bottom sheet header row: `PASO 1 DE 3 · UBICACIÓN DEL EQUIPO` `font-label text-[11px] uppercase tracking-wider text-slate-400 font-bold`; right `CLIMATIZACIÓN` chip `bg-canvas px-2 py-0.5 rounded border text-[11px]` (A5 L140-146) | Numbered fieldsets "1. Línea de especialidad / 2. Contanos la falla / 3. Dónde es el servicio" (`.cd-bloque__titulo` `.78rem` uppercase `--cd-muted`, `styles.css:611-618`) — different IA presentation (form sections vs wizard pills) | Decide: linear form (current, honest) vs 3-step wizard. If wizard, mirror Stitch captions exactly. |
| MAJOR | Address confirm card | `bg-canvas/80 border rounded-xl p-3.5`: `location_on` FILL 1 cyan in 36 px tile + bold address `Av. Cabildo 2450, 4° B, Belgrano, CABA` + sub "Punto de referencia detectado en mapa" + trailing cyan "Editar" text button (A5 L148-165) | Missing; resolved address only appears as raw text in `.cd-coordenadas` mono line ("Latitud … · Longitud …") or the input value (`solicitar-servicio.page.ts:296-301`, `424-428`) | Add the confirmation card once geocoding succeeds (it has the data: `direccionFormateada`). |
| MAJOR | Location-type chips | `h-8 px-3 rounded-lg text-xs`: active = `border-primaryCyan/70 text-primaryCyan` + filled `home` icon; others "Comercio / Local" (`storefront`), "Otro" (`more_horiz`), `bg-canvas border-borderMuted text-slate-300` (A5 L166-179) | `tipoCliente` chips only inside the (hidden-until-error) quick-perfil card, and only Persona/Empresa — **no home/business/other chips for the service address** (`solicitar-servicio.page.ts:124-137`) | Add domicilio chips wired to OT payload if backend supports (`tipoInmueble`?) or drop from design. |
| MAJOR | Bottom sheet | `absolute bottom-0 rounded-t-2xl (20px) bg-surface border-t shadow-[0_-12px_32px_rgba(0,0,0,0.6)] px-5 pt-3 pb-8`: 40×4 px grabber `bg-slate-700/80`; content per above; safe-bottom padding; `rounded-t-2xl` not `xl` (A5 L136-191) | Not a sheet; inline form; radius of `.cd-bloque` is 8 px | If wizard parity is wanted, wrap paso content in sheet; else document deviation. |
| MAJOR | Primary CTA | `h-12 rounded-xl bg-primaryCyan text-slate-950 font-headline font-bold text-sm tracking-wide uppercase` + `arrow_forward` 18 px + `shadow-[0_0_20px_rgba(34,211,238,0.25)]` + hover `#38e1fa` + `active:scale-[0.99]`; label "Confirmar ubicación" (A5 L183-186) | `ion-button expand="block"` "Emitir solicitud" + `compass-outline` icon (unregistered → blank); 36 px, uppercase, Material shadow, 8 px (`solicitar-servicio.page.ts:309-321`) | RC-3; label differs ("Emitir solicitud" — acceptable product copy); register `compass-outline` or swap `arrow-forward-outline`. |
| MAJOR | Category tiles | (No category grid in A5; categories come from A4/affinity flow) | 2-col grid `.cd-categoria` `#0e1828` tiles, icon `font-size: 1rem`; **icons `snow-outline` `thermometer-outline` `flash-outline` `water-outline` are NOT registered → render blank** (`main.ts:17-26`, `solicitar-servicio.page.ts:41-50`); active = cyan tint border ✓ | RC-4 (register icons); increase icon size to ~1.25rem; 12 px radius on active? keep 8. |
| MINOR | Helper copy | "El técnico asignado acudirá a este domicilio para la inspección inicial del equipo. Podrás coordinar detalles específicos luego." `text-[13px] text-slate-400` | "Contanos la falla…" / "El técnico necesita el punto exacto… El mapa con pin arrastrable llega en la próxima entrega." — longer, honest, voseo ✓ | Keep app copy; trim to two lines for density. |
| MINOR | Coords readout | None (map is the feedback) | `.cd-coordenadas` mono `.72rem` `--cd-muted`: "Sin ubicación todavía: el envío queda bloqueado…" when null (honest, good) | Keep; style to Space Mono when loaded. |
| MINOR | GPS FAB | `w-12 h-12 rounded-full bg-surface/90 backdrop-blur-md border` + `my_location` 22 px, `active:scale-95`, cyan focus ring (A5 L111-115) | Equivalent action exists as "Usar mi ubicación" outline button (different pattern) | Consolidate into single GPS affordance; if sheet parity not wanted, keep button. |
| NIT | Home indicator | `w-32 h-1 bg-slate-700/60` (A5 L187-189) | None (native indicator; fine) | — |

**A5 notes.** Radial-vignette map, PASO pills and bottom sheet are the entire identity of this screen in Stitch; the app faithfully implements the **data flow** (geocode / GPS / draft persistence / quick-perfil fallback) but **none of the visual language**. **Safe-area: partial** (cd-header top; content bottom padding default).

## Tab shell — `pages/modo-tabs/modo-tabs.page.ts` + `modo/modo.ts`

| Severity | Area | Stitch reference | App implementation | Fix |
|---|---|---|---|---|
| MAJOR | Bar height & padding | `h-16` (64 px) + `px-2`, `max-w-[390px]` (A3 L247, A4 L199) | md tab bar: **56 px** (`tab-bar.md.css` `:host { height: 56px }`), `padding-bottom: var(--ion-safe-area-bottom, 0)` (native safe area ok) | Set `--height: 64px` via `ion-tab-bar { --height: 64px }`? (component uses fixed `height`, not a CSS var — override `.tab-bar` host height through `ion-tab-bar { height: 64px }`) or accept 56 px as density deviation; document. |
| MAJOR | Bar background | `bg-surface/95 backdrop-blur-md border-t border-[#1e293b]/50` (A4) / `/80` (A3) | `--ion-tab-bar-background` effective **`#1f1f1f`** (dark.always `:root.md` wins over `styles.css:55`); plus `styles.css:78-80` adds `border-top: 1px solid rgba(226,232,240,.08)`; component `--border` falls back to `--ion-color-step-150` = **`#363636`** → **double top border, wrong color** | RC-1 (+ set `--ion-tab-bar-background` at `:root.md`); remove the manual `border-top` or set `--border: 0`. |
| MAJOR | Selected color | Active tab: `text-[#22d3ee]`, icon **FILL 1**, label `font-bold` (A3/A4 `person`) | `--ion-tab-bar-color-selected` effective cyan (`styles.css:58` wins over Ionic default since dark.always doesn't set it) ✓; **icons never switch to filled**; label weight normal (`modo-tabs.page.ts:27-31`, `modo.ts:33-57`) | Use `-filled` icon variants for active tab (Ionic supports `icon + icon-selected`? No — swap `name` on state or use `md` filled set). |
| MAJOR | Labels | `font-label text-[10px] uppercase tracking-wider` (A3/A4) | md `::slotted(ion-label)` → `margin-top: 2px; text-transform: none`, host `font-size: 12px; letter-spacing: .03em` — app sets nothing → labels render **12 px sentence case, not mono, not tracked** | `ion-tab-button ion-label { font-size: 10px; text-transform: uppercase; letter-spacing: .12em; font-family: 'Space Mono' }`. |
| MAJOR | Icon set & shapes | Material Symbols: `home` (filled active) / `build` / `assignment` / `engineering` / `bolt` center FAB / `person` (filled active) | ionicons outline only: `home-outline`, `cube-outline`, `person-outline`, `radio-outline`, `construct-outline`, `cash-outline`, `document-text-outline` — different glyphs, no filled active state; **CLIENTE loses Servicios/Solicitudes entirely** (Panel/Equipos/Cuenta vs Stitch Inicio/Servicios/Solicitudes/Perfil + Urgente FAB) | RC-4; reconsider tab IA vs Stitch (product call). |
| MINOR | Active/inactive contrast | Inactive `text-slate-400`, hover→primary, `active:scale-95` | md ripple + `tab-selected` cyan; inactive = `--ion-tab-bar-color` effective **`#94a3b8`** (styles.css wins — ok) — hover not modeled; no scale feedback | Add `ion-tab-button:active { transform: scale(.95) }` if desired. |
| MINOR | Center Urgente FAB | See A4 row | Not present in any modo (`modo.ts:29-58`) | Product decision. |

---

## Components & tokens — cross-screen matrix

| Token / component | Stitch | App | Status |
|---|---|---|---|
| `#0b1220` canvas | everywhere | Overridden to **`#121212`** by cascade | **BROKEN (RC-1)** |
| `#111b2e` surface | everywhere | `--cd-surface: #111c2e` (**typo drift** — `1c` vs `1b`) **and** overridden to `#1e1e1e`/`#1f1f1f` by cascade | **BROKEN (RC-1 + fix hex)** |
| `#1e293b` border | everywhere | `rgba(226,232,240,.08)` (`--cd-surface-border`) — too faint vs Stitch hairline; scoped `.cd-form` override ok | **WRONG VALUE** |
| `#0e1828` / `#162238` / `#0f172a` / `#050911` | A2/A4/A2/A2 | `#0e1828` used (`.cd-segment`, `.cd-filtros`, `.cd-categoria`) ✓ but not as named tokens; `#162238` absent; `#050911` absent | Partial |
| `#22d3ee` primary | Everywhere | `--ion-color-primary` ✓ wins cascade; used in glows/borders ✓ | **OK (keep)** |
| `#06b6d4` primary-focus (hover) | A1/A2 | `--ion-color-primary-shade: #1ebad1` (different hue step) | CLOSE |
| `#f59e0b` amber | A3/A4/A5 | `--ion-color-secondary` ✓; `.cd-chip--espera` borders ✓; tile value not wired | OK-ish |
| `#a78bfa` violet | A3/A4/A5 | `--ion-color-tertiary` ✓; used as button color="tertiary" (A5 GPS button) | OK |
| `#f87171` danger | A1/A2/A3/A5 | Error tints ✓ (`rgba(248,113,113,…)`); **Ionic `danger` itself unmodified → `#f24c58`** on `color="danger"` (cuenta sign-out, error toasts) | **PARTIAL / WRONG HUE** |
| `#22c55e` success | A3/A4/A5 | **Unused.** Chips use `#6ee7b7` (ok chip); Ionic success default `#2dd55b` on toasts | **WRONG VALUE** |
| `#94a3b8` muted | everywhere | `--cd-muted: #94a3b8` ✓ (wins nothing needed) | OK |
| `#64748b` dim | A2/A3/A4 | **Absent** — single muted tier only | MISSING (add `--cd-dim`) |
| `#e2e8f0` text | A4/A5 | `--ion-text-color` overridden → **`#ffffff`** effective (RC-1) | **BROKEN** |
| `#f1f5f9` text-bright | A2/A3 | Absent | MISSING |
| Space Grotesk | headlines/CTAs | Loaded ✓ (`index.html:21`); weight sets differ (Stitch 500/600/700 used per screen; app uses 600 mostly) | OK-ish |
| Inter | body | Loaded ✓ | OK |
| Space Mono / Public Sans | labels, badges, codes, status bar | **Not loaded** | **MISSING (RC-2)** |
| Material Symbols Outlined | all iconography | **Not loaded**; ionicons used instead | **SUBSTITUTION (RC-4)** |
| Radii | canvas 8 (lg), cards 12 (xl), pills 999, sheet 20 (2xl) | `--cd-radius: 8px` applied to cards too; buttons 8 ✓; `.cd-chip` pill; no `--cd-radius-card` | **WRONG (cards should be 12)** |
| Shadows | `0 0 20px rgba(34,211,238,.25)` CTA; `0 0 16px rgba(34,211,238,.12)` active card | None emitted — Ionic Material elevation instead | **MISSING (RC-3)** |
| Focus rings | `focus:ring-1 focus:ring-[#22d3ee]` | None | MISSING |
| Toasts | n/a (no toast screens) | Top position, Ionic colors (`#2dd55b`/`#f24c58`/`#ffce31` defaults) — **off-brand traffic-light hues** | WRONG VALUES (RC-5) |
| Disabled CTA | opacity implied | Ionic default disabled look | OK |
| Home indicator | `w-32 h-1` bar (A2/A3/A5) | None (native) | OK (correct call) |
| 390 px canvas | fixed `max-w-[390px]` | Full-bleed responsive; `26rem` auth max-width | OK (responsive) / MINOR width bug |
| Safe areas | `env(safe-area-inset-*)` everywhere + fallbacks | Partial: auth wrapper + `cd-header`; plain `ion-header` pages unprotected; tab bar native padding ok; `index.html` has `viewport-fit=cover` ✓ + `theme-color #0b1220` ✓ + `color-scheme dark` ✓ | **PARTIAL** |

## Color fidelity — quick verdict
Primary cyan (`#22d3ee`) and amber/violet secondaries survive the cascade **only because `styles.css` is loaded after `dark.always.css` at equal specificity**. Every neutral (`canvas`, `surface`, `text`, item/toolbar/tab-bar/card backgrounds, all `--ion-*-step-*`) loses to `:root.md`. Net effect: the app is **dark-gray Material, not Dark Ops**. See RC-1.

## Copy & locale drift (does the app "say" the same thing?)

The Stitch set is **es-AR/CABA** ("¿Olvidaste tu contraseña?" keep, vos form, CABA/AMBA, Ley AR-PDP, TLS 1.3, `.com.ar`). The app is **es-CO/Cúcuta** (`es-CO` locale, `index.html:16`, Ley 1581 Habeas Data, NIT/razón social, `.com.ar` absent). This is a **deliberate market pivot** (web app ships es-CO), not an accident — do **not** "fix" it toward Argentine copy. What IS drift:

| Where | Stitch | App | Action |
|---|---|---|---|
| Login CTA | "Ingresar" | "Entrar" (`login.page.ts:107`) | Keep "Entrar"? Better parity: "Ingresar" — either fine, but pick one. |
| Login tagline | "Servicio técnico oficial a domicilio" | "Operaciones en frío, en tiempo real." (`login.page.ts:57`) | Product voice call; both fine. |
| Login labels | "CORREO ELECTRÓNICO" / "CONTRASEÑA" (mono caps) | Ionic stacked "Correo" / "Contraseña" (normal case) | Load Space Mono + caps transform (RC-2). |
| Login register link | "Crear cuenta" | "Creá una" (`login.page.ts:114`) | Keep vos; acceptable. |
| Registro role captions | "Hogar / Com" · "Matriculado" · "Repuestos" | "Necesito un servicio" · "Presto servicios" · "Vendo insumos" (`registro.page.ts:43-47`) | App copy is clearer; keep. |
| Registro privacy | TLS 1.3 / AR-PDP (AR) | Ley 1581 / CO (correct market) | Keep. |
| Registro CTA | "Crear cuenta" | "Crear cuenta" ✓ | Match. |
| Forgot password | Link present (A1) | **Absent** | Decide: implement or drop from design. |
| Panel eyebrow | "PANEL DE OPERACIONES" | "Panel del cliente" (`panel-cliente.page.ts:73`) | Keep app's clearer label, or match caps styling. |
| Panel metrics | "ACTIVAS / COMPLETADAS / SIN TÉCNICO" | "Servicios en proceso / concluidos / 90 días Garantía" (`:142,148,151`) | **Meaning changes** — third tile no longer a counter; restore "Sin técnico" count tile (amber) for parity. |
| Panel subtitle | "3 de 8 totales" | "Trazabilidad en tiempo real y asignación perimetral" (`ots-cliente.ts:83`) | Marketing tone; acceptable but loses info density. |
| Solicitar CTA | "Confirmar ubicación" | "Emitir solicitud" (`solicitar-servicio.page.ts:319`) | Product call. |
| Solicitar reopen | (n/a) | Copy references Cúcuta + km radio (`panel-cliente.page.ts:76`, `solicitar-servicio.page.ts:105`) | Consistent with es-CO pivot. Keep. |
| Cuenta footer | "Confirmar modo activo" CTA + VERIFICADO | Absent | See A3. |
| "Ingresá" vs "Entrá" | mixed | consistent voseo | OK. |

## Iconography — Material Symbols vs ionicons (and the blank-icon bug)

Stitch uses **Material Symbols Outlined** exclusively, with `FILL: 1` for active/selected states (`person` in A3 tab, `location_on`/`home`/`ac_unit` pins in A5, `check` in A3 active card). The app uses **ionicons**, outlined variants only, and — critically — **registers only 8 icons** in `main.ts:17-26` (`cashOutline`, `checkmarkCircleOutline`, `constructOutline`, `cubeOutline`, `documentTextOutline`, `homeOutline`, `personOutline`, `radioOutline`).

**Unregistered (render as NOTHING in the build):** `add-circle-outline`, `time-outline`, `file-tray-outline`, `location-outline`, `chevron-forward-outline`, `search-outline`, `navigate-outline`, `compass-outline`, `snow-outline`, `thermometer-outline`, `flash-outline`, `water-outline`. Every one is referenced (panel `:81, :91, :174, :197, :212`; solicitar `:221, :275, :290, :318`, category map `:46-49`). The mobile `angular.json` assets do **not** copy `node_modules/ionicons/icons/*.svg` either — so there is no CDN/file fallback. **The app ships with invisible icons.**

| Stitch glyph | Meaning | App glyph | Verdict |
|---|---|---|---|
| `arrow_back` / `arrow_back_ios_new` | back | ion-back-button (md auto) | OK shape, unstyled |
| `visibility` | toggle password | (text button) | Swap for `eye-outline` |
| `error` / `warning` | inline errors | (none) | Add `alert-circle-outline` |
| `home_repair_service` / `engineering` / `inventory_2` | mode cards | none | Use `home-outline`/`construct-outline`/`cube-outline` + build tiles |
| `check` / `check_circle` | active confirm | `checkmark-circle-outline` (registered ✓) | Use filled `checkmark-circle` |
| `kitchen` / `ac_unit` / `local_laundry_service` | OT category tiles | none | Missing component |
| `chevron_right` | list affordance | `chevron-forward-outline` (**blank**) | Register |
| `notifications` + amber dot | bell | none | Missing |
| `south` (pulse) | pull refresh hint | (refresher default) | Missing hint bar |
| `build` / `assignment` / `engineering` / `person` (FILL 1) | tabs | `construct-outline` etc. / `person-outline` | Substituted; no filled state |
| `bolt` (FAB) | Urgente | none | Missing |
| `location_on` / `my_location` / `near_me` / `search` | A5 map | `navigate-outline` / `search-outline` (**blank**) | Register or drop |
| `swap_horiz` | A3 banner | none | Add `swap-horizontal-outline` |
| `verified_user` / `shield` | A1/A2/A3 | none | Add `shield-checkmark-outline` |
| `add` / `chevron_right` | A3 "agregar perfil" | none | Register |
| `receipt_long` | finalized OT | none | Optional |
| `build_circle` / `speed` | A4 diagnostic CTA | none | Missing block |

**Rule going forward:** register every referenced icon in `main.ts` (or import per-page), and prefer `-filled` variants for selected/active states; document any deliberate Material→Ionicons substitution.

---

## Root causes (systemic)

### RC-1 — Ionic dark palette is never correctly overridden (**breaks every screen**)
`dark.always.css` (loaded in `angular.json` before `styles.css`) declares the dark scheme under `:root.md` / `:root.ios` (specificity **0,2,0**). `styles.css` declares its overrides under **`:root`** (specificity **0,1,0**). Later order does NOT compensate for lower specificity, so the Ionic variables resolve to:

- `--ion-background-color: #121212` (not `#0b1220`) · `--ion-text-color: #ffffff` (not `#e2e8f0`)
- `--ion-item-background: #1e1e1e` · `--ion-toolbar-background: #1f1f1f` · `--ion-tab-bar-background: #1f1f1f` · `--ion-card-background: #1e1e1e` · `--ion-tab-bar-background-focused: #353535`
- all `--ion-*-step-50…950` (borders/skeletons/ripples, e.g. item border `#363636`)
- `--ion-color-primary: #22d3ee` **survives** (styles.css wins at equal 0,1,0 — order saves it); `--ion-color-danger: #f24c58`, `--ion-color-success: #2dd55b`, `--ion-color-warning: #ffce31`, `--ion-color-medium: #989aa2` **do not** (styles.css never sets them).

**Minimal fix** — in `styles.css:11-59`, change the wrapper and add the missing tokens:
```css
:root, :root.md, :root.ios {            /* loads after dark.always.css → wins at equal/higher specificity */
  --ion-background-color: #0b1220;
  --ion-background-color-rgb: 11, 18, 32;
  --ion-text-color: #e2e8f0;
  --ion-text-color-rgb: 226, 232, 240;
  --ion-item-background: #111b2e;
  --ion-toolbar-background: #111b2e;
  --ion-toolbar-color: var(--ion-text-color);
  --ion-card-background: #111b2e;
  --ion-tab-bar-background: #111b2e;
  --ion-tab-bar-background-focused: #16243a;
  --ion-tab-bar-color: #94a3b8;
  --ion-tab-bar-color-selected: #22d3ee;
  --ion-color-danger: #f87171;   --ion-color-danger-rgb: 248,113,113;   --ion-color-danger-contrast: #2a0a0a;
  --ion-color-success: #22c55e;  --ion-color-success-rgb: 34,197,94;    --ion-color-success-contrast: #052e16;
  --ion-color-warning: #f59e0b;  --ion-color-warning-rgb: 245,158,11;   --ion-color-warning-contrast: #1a1204;
  --ion-color-medium: #94a3b8;   --ion-color-medium-rgb: 148,163,184;   --ion-color-medium-contrast: #0b1220;
  /* step scale, at least the ones used: */
  --ion-background-color-step-150: #1e293b;  /* item/divider hairline */
  --ion-background-color-step-250: #334155;
  …
}
```
**Verify:** devtools `getComputedStyle(document.documentElement).getPropertyValue('--ion-background-color')` → `#0b1220`.

### RC-2 — Fonts: Space Mono / Public Sans never loaded (labels fall back to Inter)
`index.html:20-23` loads **Space Grotesk + Inter only**. Stitch uses **Space Mono** (A1/A2/A4/A5 labels, badges, codes, `09:41`, `SISTEMA ACTIVO`) and **Public Sans** (A3/A4 `font-label`). Every `font-label`/`font-mono` element in the app silently renders Inter.
**Fix** — single link:
`…family=Space+Mono:wght@400;700&family=Public+Sans:wght@500;600;700&display=swap`
and set `--cd-font-mono: 'Space Mono', monospace; --cd-font-label: 'Public Sans', sans-serif;` then use in `.cd-eyebrow`, `.cd-ot__codigo`, tab labels, metric labels. Files: `index.html`, `styles.css`.

### RC-3 — CTA recipe missing (48 px, glow, normal case, headline font, 12 px radius)
Stitch primary CTAs: **h-12/50 px, `rounded-lg/xl` (8/12 px), `font-headline` 600/700, normal/uppercase-as-written, `shadow-[0_0_20px_rgba(34,211,238,0.25)]`, `active:scale-[0.99]`, text `#0b1220`/`#042f2e`.**
App renders Ionic md `ion-button`: **36 px, UPPERCASE, `.875rem`/500/`.06em`, 8 px, Material elevation** (`button.md.css` `:host` block).
**Fix** — add once, reuse everywhere:
```css
.cd-cta { --border-radius: 12px; min-height: 48px; text-transform: none; letter-spacing: 0;
  font-family: var(--cd-font-headline); font-weight: 700; font-size: .875rem;
  --box-shadow: 0 0 20px rgba(34,211,238,.25); }
.cd-cta::part(native) { /* if shadow parts needed */ }
```
…or set those `--*` props on `ion-button.cd-cta`. Files: `styles.css`, all pages (login, registro, solicitar; panel/cuenta when they get CTAs).

### RC-4 — Icon system: unregistered ionicons → blank glyphs; Material Symbols substituted
See Iconography section. **Fix:** extend `addIcons()` in `main.ts` with every referenced name (15+), or switch to direct SVG imports per page for tree-shaking; adopt `-filled` for selected tab/pin/check states; if strict parity desired, load Material Symbols font in `index.html` and drop ionicons (heavier but 1:1 with Stitch). Files: `main.ts`, `angular.json` (assets if font approach).

### RC-5 — Status/semantic hues default to Ionic traffic-light palette
`--ion-color-danger/success/warning/medium` unset → `#f24c58` / `#2dd55b` / `#ffce31` / `#989aa2`. Toasts (`toast.service.ts:8-13`) and `color="danger"` (cuenta sign-out) render these.
**Fix:** RC-1 block (set the four + `-shade`/`-tint` variants), and keep `#f87171` / `#22c55e` / `#f59e0b` / `#94a3b8`.

### RC-6 — Tab bar: wrong height, wrong label type, wrong fill/active model, no Urgente slot
Ionic md bar is **56 px** fixed with 12 px sentence-case labels; Stitch is **64 px** with 10 px Space-Mono-ish uppercase tracked labels and FILL-1 active icon; CLIENTE has no Servicios/Solicitudes tabs and no center Urgente FAB.
**Fix:** `ion-tab-bar { height: 64px; } ion-tab-button ion-label { font: 600 10px 'Space Mono'; letter-spacing: .12em; text-transform: uppercase; }` + filled icons for active (RC-4) + product decision on 5-item CLIENTE bar. Files: `styles.css`, `modo-tabs.page.ts`, `modo.ts`.

### RC-7 — Spacing/radii scale drift (8 px everywhere)
Stitch: 8 px (lg) canvas/buttons, **12 px (xl) cards & sheets**, 999 px pills, 4 px badges, 20 px sheet top. App: `--cd-radius: 8px` applied to cards; badges are full pills; no 12/4/20 tokens.
**Fix:** add `--cd-radius-card: 12px; --cd-radius-badge: 4px; --cd-radius-sheet: 20px;` and re-map `.cd-card`, `.cd-ot`, `.cd-bloque`, `.cd-metrica`, `.cd-chip--badge`. Files: `styles.css`.

### RC-8 — Cards/borders use translucent hairlines instead of `#1e293b`
`--cd-surface-border: rgba(226,232,240,.08)` (`styles.css:22`) ≈ invisible on `#111b2e`; Stitch uses solid **`#1e293b`** (and `#334155` for `outline-active`).
**Fix:** `--cd-surface-border: #1e293b; --cd-surface-border-strong: #334155;`

### RC-9 — Auth pages invent their own backdrop (radial teal gradient) & 26 rem width
Off-design gradient + too-wide canvas. **Fix:** flat canvas, `max-width: 390px`. Files: `styles.css:110-125`.

### RC-10 — Safe-area coverage is page-by-page, not systemic
Only `.cd-auth__inner` and `.cd-header ion-toolbar` carry `env(safe-area-inset-*)`. Plain `ion-header` pages (`cuenta`, `placeholder`, `solo-web`?) get **nothing**; fallbacks are missing (`env(..., 0px)` not `16px`); bottom CTA bars (when added) must use `calc(env(safe-area-inset-bottom) + 56px/64px)`.
**Fix:** global `ion-header ion-toolbar { padding-top: env(safe-area-inset-top) }` (or migrate all headers to `cd-header`), plus fallbacks; keep tab-bar native bottom padding. Files: `styles.css`, `cuenta.page.ts`, `placeholder.page.ts`.

### RC-11 — `#111c2e` ≠ Stitch `#111b2e` (hex drift)
One-character drift in `--cd-surface` (`styles.css:21`). **Fix:** `#111b2e`. Similarly note `#0e1828`/`#16243a` are app-invented darks (acceptable as "pressed/inset" surfaces if tokenized and documented).

### RC-12 — Writer mid-flight: A4 grew a "Ver seguimiento" button pointing at an unmatched route
`panel-cliente.page.ts:204-214` navigates to `/cliente/ot/:id`; **no such route exists** (`app.routes.ts` ends with `** → login`), so the button bounces users to `/login`. Not a visual bug — but it ships a dead-end. Flag for the writer's session; out of audit scope to fix.

---

## Top 10 fixes by impact (do these first)

1. **RC-1 cascade remap** (`styles.css` `:root` → `:root, :root.md, :root.ios` + add danger/success/warning/medium + step tokens). Everything turns from Material-gray to Dark Ops in one edit.
2. **Fix `--cd-surface: #111c2e → #111b2e`** and **`--cd-surface-border → #1e293b`** (RC-8, RC-11) — restores Stitch contrast hierarchy.
3. **Load Space Mono + Public Sans** in `index.html`; point `.cd-eyebrow`, labels, badges, codes, tab labels at them (RC-2).
4. **RC-3 `.cd-cta` recipe** (48 px, normal case, Grotesk 700, `0 0 20px rgba(34,211,238,.25)`, radius 12 px) and apply to login/registro/solicitar primary buttons — the single most visible "this is not the design" tell.
5. **RC-4 register all used ionicons** (or subset per page) — today the app shows **blank icons** on panel & solicitar.
6. **RC-6 tab bar**: 64 px, mono uppercase 10 px tracked labels, filled active icons, remove double border (drop manual `border-top`, set `--border`), decide CLIENTE IA vs Stitch (Panel/Equipos/Cuenta vs Inicio/Servicios/Urgente/Solicitudes/Perfil).
7. **Card geometry pass (RC-7)**: `ion-card`/`.cd-bloque`/`.cd-metrica`/`.cd-card` → **12 px** radius; badges → **4 px**; add `#162238` tile token; inputs get Stitch focus ring (`border-color: #22d3ee; box-shadow: 0 0 0 1px #22d3ee`) and red-tinted invalid state with `aria-invalid`.
8. **A1/A2 chrome rebuild**: flat canvas, 390 px, header row (back + centered title + secure icon), "SISTEMA ACTIVO"/secure-channel line, card-wrapped form with leading input icons, footer with safe-area padding + hotline/cipher copy (localized), password eye-icon toggle, **drop the radial gradient** (RC-9).
9. **A4 structural parity**: identity row (logo + caption + CLIENTE pill + bell w/ amber dot **or** documented omission), 3 metric tiles with **amber "Sin técnico"** variant, pill-chip filters (replace Material segment), OT cards with icon tiles + 4 px badges + chevron (registered), **fixed bottom glow CTA**, **center Urgente FAB decision**, dashed "Diagnóstico rápido" block (or descoped in writing).
10. **A3 rebuild + safe-area sweep (RC-10)**: avatar w/ gradient ring + presence dot, VERIFICADO pill, swap-mode banner w/ icon, icon-led mode cards (active = 2 px cyan border + glow + "En uso" pill), "Agregar perfil" section, plain `ion-header` pages get `env(safe-area-inset-top)` padding (or migrate to `cd-header`).

## Could not verify (explicitly **not** claimed)

- **Pixel exactness / rendered look** — no build, no screenshot, no device. All "effective values" are cascade/source-derived. The `:root.md` analysis is solid, but shadows, blur, ripples and `backdrop-filter` rendering need a device/emulator pass.
- **Capacitor StatusBar behavior** — `capacitor.config.ts` sets nothing (no `StatusBar.overlaysWebView`, no plugin); whether content slides under the status bar on the P1 Android build is **unknown**. Plain `ion-header` pages risk overlap if overlay is enabled.
- **`ion-refresher`, `ion-toast`, disabled-state visuals** — Ionic internals not fully traced; assumed md defaults.
- **Logo artwork** — Stitch uses an `aida`-hosted raster; app uses inline SVG snowflake. No artwork comparison possible; marked as acceptable substitution, not fidelity.
- **Icon runtime** — rendering of unregistered names assumed blank (standard Ionic Angular behavior with `addIcons`); not executed to confirm visually.
- **A6 route `/cliente/ot/:id`** — referenced by in-flight writer code; route table verified absent (falls through to `**` → `/login`). Reported as-is; not reproduced at runtime.
- **Writer's in-flight changes** — file contents may drift after this audit; line refs are a snapshot (2026-11-03).
- **es-CO vs es-AR product pivot** — assumed intentional (matches web + `es-CO` locale). If the Stitch deck is the contract regardless of market, every copy string in the "Copy & locale drift" table is a delta; if the pivot stands, only the styling deltas count.
- **Placeholder pages & `solo-web`** — exist (`pages/placeholder.page.ts`, `pages/solo-web/solo-web.page.ts`) and were not fidelity-audited (no Stitch counterpart / out of scope).
- **Desktop/tablet behavior** — Stitch is a 390 px phone canvas; the app is full-bleed responsive. Not a defect, flagged for completeness.

## Bottom line
The app is **functionally faithful** (real auth, real OTs, honest error/empty states, draft persistence, dual-role handled) but **visually not the Dark Ops design** — and it isn't close by accident: **one root-cause cascade bug** (RC-1) de-brands every screen, and the rest is missing Stitch components (chrome, glow CTAs, icon tiles, Urgente FAB, fixed CTAs, mono labels) plus two self-inflicted gaps (unregistered icons, fonts never loaded). Fix RC-1 → RC-3 → RC-4 → RC-6 and re-audit A1/A2 for **CLOSE**; A3/A4/A5 need the structural rebuilds listed above before they can claim anything but **OFF-BRAND**.

## Estado de implementación (actualizado 2026-11-04)
Implementado: RC-1..RC-4 y RC-6 (`3f83991`), chrome y card de A1/A2, identidad/tiles/métrica amber/filtros en A4, rebuild de A3 con avatar y tarjetas de modo, safe-area de headers planos, foco/invalid de inputs, card de ubicación de A5, quitar el scroll horizontal y la CTA fija de A5 (parcial).

### Decisiones de omisión (deliberadas, no defectos)
- **A4 — FAB "Urgente" y bloque "Diagnóstico rápido"**: no se implementan porque no existe flujo de urgencia ni autodiagnóstico del cliente en el backend. La CTA primaria del hero cubre la acción real ("Pedir un técnico"). Un botón sin flujo sería UI falsa.
- **A4 — campana de notificaciones**: omitida mientras no exista centro de notificaciones. El punto ámbar de Stitch no se simula.
- **Tab bar — IA de 3 tabs** (Panel/Equipos/Cuenta · Radar/Mis OTs/Liquidaciones/Cuenta · Insumos/Documentos/Cuenta): se mantiene la de 3–4 por modo. La de 5 de Stitch incluye "Urgente" y "Solicitudes" sin flujo propio en la app; adoptarla requeriría producto nuevo.
- **A5 — mapa interactivo con pin**: descopeado a P3 (mapas nativos / key por plataforma). Hoy la dirección se geocodifica por el proxy o se toma del GPS, con card de confirmación.
- **A3 — "Agregar perfil"**: se muestra como bloque informativo, no como botones: el alta de perfil secundario no tiene pantalla móvil todavía.
- **Logo**: se mantiene el SVG propio (el asset de Stitch es un raster alojado en `aida`, no licenciado para el repo).
