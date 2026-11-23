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

### TU-01 ✅ HECHO — Componente `<cd-page>`
**Estado:** implementado en `app/shared/ui/page/page.ts` (standalone, `OnPush`). No volver a crearlo. Es el contenedor único de las tres pantallas principales (`panel-cliente`, `equipos`, `cuenta`): proyecta `[cdHeader]` / `[cdHeroAcciones]` / `[cdFooter]` y renderiza el héroe desde los inputs `titulo`/`subtitulo`. El host es `.cd-page { display: contents }` para que Ionic siga disponiendo `ion-header`/`ion-content`/`ion-footer` como hijos flex de `.ion-page`.
**Trabajo restante (opcional):** migrar el resto de pantallas secundarias; para eso envuelve el contenido en `<cd-page>` y proyecta los slots, sin cambiar estilos visibles.
**Aceptación ya cumplida:** las tres pantallas principales comparten el shell; la jerarquía y la regla están en `DESIGN.md` §5; `mobile:test` y `mobile:build` OK.

### TU-02 ✅ HECHO — `styles.css` por capas
**Estado:** implementado. `styles.css` importa `styles/tokens.css`, `styles/base.css`, `styles/componentes.css` y `styles/pantallas.css` en ese orden, y `scripts/check-styles.mjs` / `check-ui-rules.mjs` leen todos los archivos. No volver a crear los archivos ni a unirlos en un `styles.css` monolítico.
**Trabajo restante (opcional):** si aparece una regla duplicada, fusionarla dejando la regla ganadora actual (la última); nunca subir un techo.
**Aceptación ya cumplida:** `ui:check` y `check-styles` OK; `mobile:build` OK; ningún token declarado dos veces.

### TU-11 🟢 Limpiar la web (techos de `web`)
**Objetivo:** bajar `UI-A2 web` (28 `outline-none`), `UI-C1 web` (5 grises), `UI-D1 web` (17 blur), `UI-L1 web` (19 voseo). Una regla por commit.
**Aceptación:** `ui:check` baja la fila; `ng test` (web) OK; `ng build` OK.

### TU-08 🟡 Datos de seed para ver todas las pantallas  *(toca backend)*
Ver `docs/backend/TAREAS-BACKEND.md` TB-10: sembrar una OT en cada estado y una oferta pendiente, solo en perfil `dev`. Después añadir esas rutas a `scripts/ui-audit.mjs` (seguimiento, diagnóstico, pago, ejecución, radar con ofertas, solicitudes del proveedor).

### TU-09 🟡 Probar en Android real  *(requiere dispositivo)*
Safe-area con notch, teclado virtual (el CTA fijo no debe tapar el campo; evaluar `@capacitor/keyboard`), WebView (`:has()`, `dvh`), fuente del sistema al 130–150 %. Documenta hallazgos en `DESIGN.md` §8.

### TU-12 🟢 Auditoría Playwright en CI
**Estado (2026-11-23): instalado y medido en local.** `playwright-core` está en `devDependencies`, el job `ui-audit` existe en `.github/workflows/frontend-ci.yml` con `continue-on-error: true` (temporal: depende del seed de TU-08 y del secreto `UI_AUDIT_PASSWORD`).

```bash
cd frontend
npx playwright-core install chromium          # una vez por máquina
UI_AUDIT_PASSWORD=<password demo del seeder> npm run ui:audit
# salida esperada: "pantallas auditadas: 65, con hallazgos: 0"
```

Requiere backend en `:8090` y la app servida en `:4200`. El script inicia sesión UNA vez por rol (rate limit 10/min por IP: no lo relances en bucle; si ves "Correo o contraseña incorrectos" tras varios intentos, es 429 — espera un minuto).

**Trabajo restante:** quitar `continue-on-error` cuando TU-08 siembre las pantallas con datos; sumar el job a los checks obligatorios de `main`.

### TU-13 🟢 Restaurar el origen de producción
`frontend/.env`: si `MOBILE_API_ORIGIN` apunta a `localhost`, restaura la URL de producción **antes** de `mobile:build`, `mobile:apk` o `mobile:aab`. Añade a `scripts/build-apk.mjs` un chequeo que **aborte** si el origen es `localhost`.
**Aceptación:** `npm run mobile:apk` con origen local falla con mensaje claro.

---

### TU-14 🟡 (parcial: liquidaciones-tecnico hecho; proveedor pendiente) Homogeneidad: colas a `cd-page` y detalles con estados
**Objetivo:** cerrar las brechas de `docs/design/NAVEGACION.md` §3. **Una pantalla por commit.**
**Orden:** `liquidaciones-tecnico`, `solicitudes-proveedor`, `documentos-proveedor` → `cd-page` (plantilla Cola); luego skeleton + error con reintento en `seguimiento-ot`, `ejecucion-ot`, `diagnostico`, `pago-acta`; luego error en `documentos-proveedor` y vacío/error en `perfil-tecnico`.
**Aceptación:** la fila de la pantalla en NAVEGACION §3 queda completa; specs de carga/vacío/error; `ui:check`, `mobile:test`, `mobile:build` OK.

### TU-15 ✅ Navegación: volver predecible y alcanzabilidad (UI-N1/N2)
**Objetivo:** que `ion-back-button` lleve al padre real y su etiqueta no mienta (`ejecucion-ot`, `perfil-tecnico` dicen «Volver al panel» y van a Mis OTs); añadir un spec que compare las rutas de `app.routes.ts` con la lista de entradas de NAVEGACION §1 y falle si una ruta no tiene entrada.
**Aceptación:** spec nuevo en verde; `grep -rn "Volver al panel" projects/mobile` sin discrepancias.

### TU-16 🟡 Huecos de funcionalidad frontend (F1, F2, F5, F6, F7)
**Objetivo:** pantalla `recuperar` + enlace en login (F1); datos y contraseña en Cuenta (F2, tras decidir D4); countdown vivo del radar (F5); `ion-refresher` en las colas del proveedor y del técnico (F6/F7).
**Aceptación:** por hueco, spec nuevo + fila actualizada/borrada en NAVEGACION §2.

## Progreso (2026-11-23) — para retomar en otro equipo

- **Rama:** `feat/mobile-stitch-integration` (desde `main`). Commits: export Stitch + renovación de reglas; barra de marca e iconos compartidos; integración de pantallas Stitch en cliente, técnico y proveedor; baseline `UI-L1` mobile 22→13.
- **Verificado:** `ui:check` OK. Suite `mobile`: 301 OK, 7 fallos en `modo/modo.service.spec.ts`, **los mismos 7 fallan en `main`** (deuda previa, no introducida por esta rama).
- **Mocks:** `useMocks: false` por defecto (igual que `main`). No se commitió ningún cambio de demo.
- **Pendiente de este backlog:** TU-07 (quitar Public Sans), TU-03 (títulos mono y eyebrows), TU-04 (estados carga/vacío/error), TU-06 (señal de scroll), TU-05 (13 usos de voseo en móvil), TU-10 (blur 1, halos 4, gradiente 1, `env()` directo 4).
- **1:1 Stitch sin auditar:** B0 Panel Técnico, A4 Panel Cliente, A8 Pago y acta, B3 Ejecución, A7 (auditoría completa), B2 Mis OTs, A1/A2.
- **Bloqueado por backend:** ver `renovacion-reglas-stitch.md` §2 y §5.
- **Fuera de los commits (sin decidir):** cambios de demo en `frontend/src/app/core/service/*` (WS5), `node_modules/` en la raíz (sin regla de `.gitignore`), caché `.atl/`.

## Fuera de alcance de este backlog
Rediseño visual (no se recomienda: el sistema ya está implementado), tablet de dos columnas, modo claro, `landing/`.
