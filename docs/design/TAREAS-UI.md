# TAREAS-UI — backlog ejecutable de diseño

Léelo junto con `/DESIGN.md` (ley). Cada tarea es **atómica**, se hace en **su propio commit** y se acepta **solo** si pasan sus comandos de aceptación. Orden recomendado abajo. Una tarea terminada baja techos del baseline: corre `npm run ui:check -- --update` y commitea `frontend/scripts/ui-rules.baseline.json` (nunca lo edites a mano, nunca subas un techo).

Todos los comandos se ejecutan en `frontend/`. Antes de empezar cualquier tarea: protocolo de `DESIGN.md` §0. Al terminar: checklist `DESIGN.md` §11.

Leyenda de modelo: 🟢 modelo barato suficiente · 🟡 conviene uno más capaz o revisión humana.

---

## Orden y dependencias

`TU-10 → TU-07 → TU-06 → TU-05 (por pantalla) → TU-03 → TU-04 (por pantalla) → TU-01 → TU-02 → TU-11 → TU-12`
`TU-08`, `TU-09`, `TU-13` son independientes (TU-08 toca backend: ver `docs/backend/TAREAS-BACKEND.md`).

---

### TU-10 🟢 Limpiar deuda mecánica del móvil
**Objetivo:** bajar a 0 `UI-D1/D2/D3` (móvil) y `UI-S1` (móvil).
**Hoy:** 1 `backdrop-filter`, 4 halos cian `0 0 Npx`, 1 gradiente, 4 `env(safe-area-inset-*)` directos en `projects/mobile/src/styles.css`.
**Pasos:** localiza con `node scripts/check-ui-rules.mjs --verbose`. Halos → borde 1 px o fondo `--cd-surface-2` (solo el CTA primario conserva *Accent Glow*; si ese es el halo, déjalo y regístralo como excepción en DESIGN.md §2.3). Gradiente (fondo de auth) → color plano `--cd-canvas`. `env(...)` → `var(--cd-safe-top|bottom)`. Blur del overlay del modal → `rgba(2,6,23,.7)` sin blur.
**Aceptación:** `npm run ui:check` OK y las filas `UI-D1/D2/D3/S1 mobile` bajan; `npm run mobile:test` OK; `npm run ui:audit` sin hallazgos nuevos.

### TU-07 🟢 Fuentes
**Objetivo:** solo Space Grotesk, Inter, Space Mono. Quitar Public Sans.
**Pasos:** `grep -rn "Public Sans" projects/mobile/src` → reemplazar `--cd-font-label` por Inter; revisar `public/fonts.css` e `index.html` (preload solo Inter y Space Grotesk, sin `<link>` duplicado). Mantener `font-display: swap`.
**Aceptación:** `grep -rn "Public Sans" projects/mobile` vacío; `mobile:build` OK; `ui:audit` sin hallazgos.

### TU-06 🟢 Señal de scroll en filtros
**Objetivo:** `.cd-filtros` y `.cd-filtros-tecnicos` muestran que hay más contenido a la derecha.
**Pasos:** degradado en el borde derecho **solo cuando hay desborde** (no siempre: a 430 px caben). Usa scroll-driven o una clase puesta por JS al medir `scrollWidth > clientWidth`. Añade `data-scroll-x` al contenedor.
**Aceptación:** a 360 el último filtro aparece atenuado; a 430 no; `ui:audit` sin hallazgos; spec de `panel-cliente` OK.

### TU-05 🟢 Migrar copy a tuteo (por pantalla)
**Objetivo:** `UI-L1` mobile de 40 → 0, web de 19 → 0.
**Pasos (una pantalla por commit):** `node scripts/check-ui-rules.mjs --verbose | grep UI-L1`. Cambia solo el copy: `tenés→tienes`, `podés→puedes`, `pedí→pide`, `creá→crea`, `revisá→revisa`, `Elegí→Elige`, etc. Actualiza el spec de esa pantalla (los specs asertan los textos). Mantén registro y vocabulario de `PRODUCT.md`. No mezcles voseo y tuteo dentro de una pantalla.
**Aceptación:** `ui:check` baja `UI-L1`; `mobile:test` OK; `grep -rn "tenés\|podés" projects/mobile/src/app/pages/<pantalla>` vacío.

### TU-03 🟡 Títulos mono → Space Grotesk y fuera eyebrows
**Objetivo:** cumplir `UI-T3` y `UI-T5`.
**Pasos:** títulos de tarjeta (`.cd-card__titulo`, "DISPONIBILIDAD", "COMPARTIR UBICACIÓN"…) → Space Grotesk 15–16 px, frase, sin tracking ancho. Elimina el eyebrow sobre el título de pantalla en `panel-cliente`, `panel-tecnico`, `liquidaciones-tecnico`, `documentos-proveedor`, `ofertas-tecnico` (si el eyebrow aporta rol, el título ya lo dice). Si decides conservar un overline legítimo (2–3 palabras, dato), documenta por qué en el PR.
**Aceptación:** capturas antes/después a 360 px; `ui:audit` limpio; specs actualizados; `ui:check` OK. *(Considera añadir una regla `UI-T3` automática a `check-ui-rules.mjs` que cuente `font-family: var(--cd-font-mono)` en selectores `*__titulo`.)*

### TU-04 🟡 Estados de carga / vacío / error (por pantalla)
**Objetivo:** `DESIGN.md` §5 (UI-X6). Pantallas con datos remotos: `panel-cliente`, `equipos`, `panel-tecnico`, `ofertas-tecnico`, `liquidaciones-tecnico`, `perfil-tecnico`, `solicitudes-proveedor`, `documentos-proveedor`, `seguimiento-ot`.
**Pasos:** reutiliza `shared/ui/{skeleton,loading,empty-state,error-alert}`. Cargando = skeleton con la forma de la lista; vacío = una línea + una acción; error = qué falló + botón reintentar. Un spec por estado.
**Aceptación:** por pantalla, tres specs nuevos (carga, vacío, error) en verde; `ui:audit` limpio; ningún `*ngIf` anidado ilegible (usa `@if/@else`).

### TU-01 🟡 Componente `<cd-page>`
**Objetivo:** un solo contenedor de página (header con título/subtítulo/acción + `ion-content` con gutter + `ion-footer` opcional) para reemplazar 34 `ion-header` y 14 `ion-footer` escritos a mano.
**Pasos:** crea `app/shared/ui/page/page.ts` (standalone, `OnPush`) con slots `[cdActions]`, `[cdFooter]`, inputs `titulo`, `subtitulo`, `volver`. Respeta `.cd-header`/`.cd-footer`/safe-area. Migra **una página por commit**, empezando por `liquidaciones-tecnico` (simple) y terminando por `solicitar-servicio` (compleja). No cambies estilos visibles: compara capturas.
**Aceptación:** `grep -c "<ion-header" projects/mobile/src/app/pages -r` baja con cada commit; `mobile:test` y `ui:audit` limpios; capturas idénticas a 360/430.

### TU-02 🟡 Partir `styles.css` por capas
**Objetivo:** reglas duplicadas fuera (`.cd-modo`, `.cd-metricas`, `.cd-filtros`, `.cd-card` aparecen 2–3 veces; gana la última).
**Pasos:** (1) `ui:audit` y capturas **antes**. (2) Crea `projects/mobile/src/styles/{tokens,base,componentes,pantallas}.css` y un `styles.css` que los importe en ese orden (revisa `angular.json` → `styles`). (3) Mueve sin cambiar el orden efectivo; fusiona duplicados **dejando la regla ganadora actual**. (4) Actualiza `scripts/check-styles.mjs` y `check-ui-rules.mjs` para leer todos los archivos (hoy leen solo `styles.css`).
**Aceptación:** capturas **byte-idénticas o equivalentes** a 360/390/430; `ui:check` y `check-styles` OK; `mobile:build` OK; ningún token declarado dos veces.

### TU-11 🟢 Limpiar la web (techos de `web`)
**Objetivo:** bajar `UI-A2 web` (28 `outline-none`), `UI-C1 web` (5 grises), `UI-D1 web` (17 blur), `UI-L1 web` (19 voseo). Una regla por commit.
**Aceptación:** `ui:check` baja la fila; `ng test` (web) OK; `ng build` OK.

### TU-08 🟡 Datos de seed para ver todas las pantallas  *(toca backend)*
Ver `docs/backend/TAREAS-BACKEND.md` TB-10: sembrar una OT en cada estado y una oferta pendiente, solo en perfil `dev`. Después añadir esas rutas a `scripts/ui-audit.mjs` (seguimiento, diagnóstico, pago, ejecución, radar con ofertas, solicitudes del proveedor).

### TU-09 🟡 Probar en Android real  *(requiere dispositivo)*
Safe-area con notch, teclado virtual (el CTA fijo no debe tapar el campo; evaluar `@capacitor/keyboard`), WebView (`:has()`, `dvh`), fuente del sistema al 130–150 %. Documenta hallazgos en `DESIGN.md` §8.

### TU-12 🟢 Auditoría Playwright en CI
`npm i -D playwright-core`; job opcional que levanta backend con Testcontainers/seed, sirve la app en `:4200` y corre `npm run ui:audit` (necesita `UI_AUDIT_PASSWORD` como secreto). Hasta entonces `ui:audit` es manual y obligatoria antes de dar por hecha una tarea visual.

### TU-13 🟢 Restaurar el origen de producción
`frontend/.env`: si `MOBILE_API_ORIGIN` apunta a `localhost`, restaura la URL de producción **antes** de `mobile:build`, `mobile:apk` o `mobile:aab`. Añade a `scripts/build-apk.mjs` un chequeo que **aborte** si el origen es `localhost`.
**Aceptación:** `npm run mobile:apk` con origen local falla con mensaje claro.

---

## Fuera de alcance de este backlog
Rediseño visual (no se recomienda: el sistema ya está implementado), tablet de dos columnas, modo claro, `landing/`.
