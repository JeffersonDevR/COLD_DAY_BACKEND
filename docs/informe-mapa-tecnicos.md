# Informe de intervención UI — mapa y búsqueda de técnicos (móvil)

Fecha: 2026-11-12 · Alcance ejecutado: **app móvil (Ionic)**, con foco en la experiencia de mapa.
Backend: **sin cambios** de endpoints, DTOs, modelos ni lógica.

---

## 1. Punto de partida

El cliente móvil llegaba a una orden `BUSCANDO_TECNICO` y solo veía una tarjeta de texto
("Buscando técnico…"). La app no pedía técnicos cercanos ni dibujaba mapa en ese estado: la
búsqueda en mapa solo existía en la web (`shared/mapa-radar`). El técnico, en campo, no tenía
forma de abrir la ruta al domicilio desde la ejecución de la OT.

El README del frontend era todavía la plantilla de AI Studio (pedía `GEMINI_API_KEY`), sin
relación con este producto.

## 2. Cambios (antes → después)

| Área | Antes | Después |
|---|---|---|
| Búsqueda de técnicos (cliente) | Tarjeta de texto, sin datos | Mapa con candidatos + lista equivalente, filtros por especialidad, contador y radio visibles |
| Estado sin resultados | Texto genérico | EmptyState con acciones reales: ampliar radio hasta el tope del backend, quitar filtro |
| Fallo de consulta | Caía en lista vacía (mentía sobre la causa) | Estado de error separado, con reintento |
| Estados de espera | Solo texto | Spinner con rol `status` y mensajes que no prometen progreso falso |
| Marcadores | Círculos iguales | Cian (disponible), ámbar (elegido), globo con conteo cuando se agrupan |
| Agrupación | No existía | Retícula por zoom: ≥16 cada técnico; al alejar, globo con número; tocarlo acerca |
| Selección | No existía | Marcador ↔ fila sincronizados; ficha con especialidad, distancia y llamada |
| Encuadre | Centro fijo | `fitBounds` con padding, solo cuando cambia el conjunto de puntos |
| Movimiento del técnico | Saltos entre sondeos de 15 s | Interpolación ease-out de 600 ms |
| Ruta | Línea simple | Casing oscuro + trazo de marca con dibujado progresivo |
| Buscar en otra zona | No existía | Botón tras mover el mapa, debounce de 400 ms, umbral ~300 m |
| Técnico: ir al domicilio | Sin acción | "Abrir ruta en Google Maps" con coordenadas validadas; aviso si faltan |
| Inicio del cliente | CTA genérico | Cuatro accesos por avería que preseleccionan especialidad (sin pisar el borrador) |
| Ofertas del técnico | "A 0.0 km" (el resumen del backend no trae distancia) | Distancia real calculada en el navegador con la ubicación del técnico y el punto de la OT; si falta alguna, "Distancia por confirmar" |
| Panel del técnico | Disponibilidad era la segunda tarjeta y solo se nombraba en el segmento | Disponibilidad primero, con chip de estado y una línea que dice si llegan ofertas y por qué no |
| Documentos (proveedor y técnico) | Un fallo de red se mostraba como "sin documentos cargados" | Estado de error explícito con reintento; el vacío queda solo para "no declaraste" |
| Ofertas web (técnico) | "Distancia aprox: **2.8 km**" y "**42s restantes**" eran literales fijos en el template: el mismo número para toda oferta, y el contador nunca bajaba | Distancia calculada con la ubicación del técnico y el punto de la OT ("Distancia por confirmar" si falta); cuenta regresiva real desde `segundosRestantes` del backend, con "Expirada" al llegar a cero |
| Panel cliente web | Un fallo de carga mostraba "No tenés servicios en curso — todos al día" | Estado de error con reintento antes del vacío |
| Liquidaciones (web) | Un fallo mostraba "$ 0 COP" y "HABILITADO — Al día con la empresa" | Resumen en "—" mientras carga o falla; error visible con reintento |
| Pago/acta (web) | Si fallaba la estimación, el "Total a Pagar" sumaba sin la visita | Total "Por confirmar" cuando falta la estimación, en vez de una suma incompleta |
| Accesibilidad móvil | Cargas y vacíos sin anuncio, foco invisible en partes shadow de Ionic, blancos táctiles de 27–37 px | 13 correcciones: regiones `status`, foco en `::part(native)`, mínimo 44 px, `aria-current` en el timeline, `aria-label` en segmentos y selects, controles con nombre |
| Hoja inferior sobre el mapa | El detalle del técnico era un bloque fijo en la página | `ion-modal` arrastrable con 3 alturas (0 / 35 % / 75 %), que deja ver el mapa abajo y se descarta tocando fuera o con "Cerrar" |
| Radar web (datos demo) | 4 técnicos de ejemplo con distancia y reputación inventadas como respaldo | Eliminados: sin datos la lista queda vacía y el radar explica "No hay técnicos disponibles en el radio"; nunca más un "0 de 0" como dato |
| Componentes base (móvil) | Cada pantalla repetía su propio markup de vacío, carga y error | `shared/ui/` con `app-empty-state`, `app-loading`, `app-error-alert`, `app-skeleton`, `app-status-badge` y `app-service-timeline` (OnPush, tokens, con pruebas). Adoptados en 9 pantallas conservando copy y `data-testid` |
| Línea de tiempo del servicio | Solo el cliente veía el ciclo de la orden | Componente compartido `app-service-timeline`, ahora también en la ejecución del técnico con su propio texto ("Dónde está la orden que tomaste") |
| Feedback táctil | No existía | Pulso al aceptar una oferta y al elegir un técnico, con la API de vibración del WebView (sin plugin nuevo) y apagado bajo `prefers-reduced-motion` |
| Documentación | Plantilla AI Studio | README real: correr, configurar, estructura, diseño y módulo de mapa |

## 3. Decisiones y por qué
1. **No prometer asignación directa.** El backend asigna por aceptación de oferta
   ("el primero que acepta la toma"). La UI lista y enfoca técnicos, pero el texto dice
   exactamente cómo se toma la orden. Se conserva el modelo del servidor.
2. **Mapa y lista a la vez, no un sheet a pantalla completa.** Con el mapa inline de 240 px,
   mover la lista a un bottom sheet habría duplicado la superficie o escondido el mapa.
   Se mantiene la lista como respaldo accesible y el mapa como protagonista.
3. **Lógica de mapa en módulos puros.** `encuadre-mapa.ts` y `agrupar-tecnicos.ts` no tocan
   Google Maps, así que se prueban en jsdom; el componente solo aplica el resultado.
4. **Encuadre con firma.** Se reajusta solo si cambian los puntos, para no pelear con el paneo
   del usuario ni con el temblor del GPS.
5. **Navegación externa sin cuota.** "Abrir ruta" es una URL pública de Maps, no una llamada a
   Directions. Directions sigue pasando solo por `RutaSeguimientoService` (60 s / 200 m).
6. **Radio de búsqueda sin tocar la OT.** Ampliar radio es una consulta más amplia
   (`radioKm` es parámetro del endpoint existente), no un cambio de orden.

## 4. Verificación ejecutada

### APK de depuración para validar la UI

`frontend/android/app/build/outputs/apk/debug/app-debug.apk` (9,9 MB) compilado con
`ng build mobile` → `cap sync android` → `gradlew assembleDebug`.

- Instalar: `adb install -r app-debug.apk` o pasar el archivo al teléfono y abrirlo con "orígenes desconocidos" habilitado.
- **Apunta al backend de producción** (`MOBILE_API_ORIGIN=https://colddaybackend-production.up.railway.app`), así que el login necesita una cuenta real.
- **Ojo con Maps en este APK:** la clave que se hornea viene del `.env` del frontend. Si ahí solo
  está `GOOGLE_MAPS_API_KEY` (la de servidor), el mapa puede no cargar en el dispositivo y,
  peor, la credencial de servidor viaja dentro del APK. Para validar mapas hay que generar el
  build con `GOOGLE_MAPS_BROWSER_API_KEY` (restringida por HTTP referrer/**package name**).
- Qué se puede validar con él: navegación entre roles con sesión, hoja inferior del técnico
  (arrastre y breakpoints), estados de carga/error/vacío, contraste y tamaños táctiles en
  pantalla real. Lo que no: consentimiento de ubicación, teclado, safe areas y rendimiento en
  gama baja sin un dispositivo físico.
Los números de esta tabla son de corridas reales sobre el estado actual del árbol; las auditorías
de accesibilidad y paridad web las hicieron agentes con permisos de solo lectura, y la suite la
ejecutó el Lead (el sandbox de los agentes bloquea esbuild con `spawn EPERM`).

| Comprobación | Resultado |
|---|---|
| `ng test mobile` | **334/334** (32 archivos) |
| `ng test` (web + móvil) | **907/907** web (85 archivos) + 317 móvil |
| `ng build mobile` | OK |
| `ng build` (web) | OK |
| `ng lint` (móvil) | limpio (80 archivos) |
| `ng lint` (web) | **14 errores preexistentes** en archivos ajenos a esta intervención: `maps-geocoder-cliente.spec.ts` (sin modificar vs HEAD), `agregar-perfil-page.html` y `solicitar-servicio-page.ts` (ya venían modificados antes de empezar) |
| `scripts/check-styles.mjs` | 28 tokens, 63/63 hex libres |
| `scripts/auditar-contraste.mjs` | todos los pares del tema ≥ 4,5:1 (mínimo 6,18:1) |
| Carga diferida del SDK | `main` 50,2 KB **sin** `maps.googleapis.com`; la URL vive en un chunk de 7,3 KB que se pide solo al abrir una pantalla con mapa |
| Backend intacto | `gradlew compileJava` → **exit 0**. No se tocó ningún endpoint, DTO, modelo ni lógica; el único archivo de backend modificado en el árbol (`MapsControllerAdvice.java`) ya venía así antes de esta intervención |

### Fuentes y captura con navegador real

- **Fuentes autofejadas:** 283 KB de woff2 en subsets latin con `font-display: swap` (Inter, Space Grotesk, Space Mono). Sin red la app se ve igual.
- **Chrome headless funciona aquí**: puede renderizar el bundle móvil (`ng build mobile` + `node scripts/servir-movil.mjs`) y medirlo por CDP. El login fue capturado y medido a 390 px reales: `main` 390, `form` 350, CTA 313 — **ningún elemento desborda** (`overflowers: []`).
- La captura muestra un corte a la derecha que **no es un defecto de la app**: el PNG es idéntico byte a byte con `--hide-scrollbars` y sin él, mientras la medición dice lo contrario. Es un artefacto del pipeline de captura headless. Conclusión honesta: el navegador sirve para **medir**, pero sus capturas no son evidencia visual fiable hasta resolver ese pipeline; la validación visual final sigue siendo tarea en dispositivo (el APK está compilado para eso).
| Salto visual del mapa | `.cd-map__lienzo` tiene alto fijo (240 px) y el bloque de carga lo llena al 100 %, así que no hay reflow al montar el mapa. El componente `app-skeleton` quedó disponible, pero forzarlo aquí sería decoración |

Bugs propios detectados y corregidos durante la verificación: `tecnicoSeleccionado` duplicado
como `output` y `computed`; falta de `IonLabel`/`TecnicosApi` en imports; `WritableSignal`
importado desde `@angular/core/testing`; arrow function en plantilla que rompía el parser de
ESLint; cierre de clase roto al editar la plantilla; y un import duplicado preexistente
(`registrarDeepLinks`) que impedía compilar el móvil.

## 5. Riesgos abiertos

- **Clave de Maps.** El `.env` local solo define `GOOGLE_MAPS_API_KEY`, que es la clave de
  servidor; `generate-maps-key.mjs` la acepta como fallback de navegador e imprime un aviso.
  Hay que crear `GOOGLE_MAPS_BROWSER_API_KEY` restringida por HTTP referrer y por API.
  Mientras no se haga, la credencial facturable viaja al bundle.
- **Sin verificación visual.** No hubo navegador automatizado ni backend con sesión en el
  entorno de trabajo: la cobertura es de DOM, tipos y compilación. Falta revisar en dispositivo
  real (375/768/1280, iOS y Android, safe areas, teclado).
- **Costo de Maps.** El SDK se carga una sola vez y por lazily; no se piden rutas en ticks. El
  riesgo restante es de configuración (cuotas y alertas en Google Cloud), no de código.
- **Warning de build preexistente:** `index.html` referencia `/fonts.css`; el archivo se copia
  desde `public/`, pero el bundler avisa que no puede resolverlo.

## 6. Pendiente

- **Deuda de lint web (previa):** 14 errores en `maps-geocoder-cliente.spec.ts`, `agregar-perfil-page.html` (`label-has-associated-control`) y `solicitar-servicio-page.ts` (`no-explicit-any`). No son de esta intervención, pero bloquean un `lint` global en verde.
- **Rechazar una oferta no se puede implementar hoy:** el backend no expone endpoint de rechazo
  (solo `POST /api/ofertas/{id}/aceptar`). Añadirlo requiere cambio de API y debe decidirse con
  el equipo de backend; no se inventó una llamada.
- **Perfil de técnico con señales de confianza:** `TecnicoCercanoApiResponse` no expone rating,
  verificación ni trabajos realizados. Mostrarlos exigiría datos nuevos del backend; inventarlos
  está prohibido por el propio producto.
- **Mapa del proveedor:** `SolicitudInsumoApiResponse` no incluye coordenadas, así que no hay
  ruta ni tiempo de entrega que dibujar sin ampliar el DTO.
- Bottom sheet: **hecho** para la ficha del técnico (3 alturas). Queda como mejora opcional llevar
  también la lista de candidatos a la hoja; hoy la lista sigue inline como respaldo accesible.
- Fase 1 completa: faltan Button, Input, Select, Card, Modal, Toast, ListItem, Avatar, Rating y
  Tabs como componentes. `app-skeleton` y `app-status-badge` existen y están probados, pero solo
  este último se adoptó en dos pantallas. Faltan por migrar los estados de vacío/carga que tienen
  CTA con `data-testid` propio (`panel-tecnico` es el caso testigo): el componente necesita un
  input para el testid de la acción antes de poder absorberlos.
- **Tarjetas de dominio sin extraer a propósito:** `JobOfferCard`, `PartRequestCard` y
  `TechnicianCard` siguen dentro de sus pantallas. Extraerlas ahora obliga a mover muchos bindings
  y `data-testid` de la superficie más crítica del técnico, y no hay verificación visual para
  respaldar el cambio; el valor sería organizativo, no para el usuario. Es el siguiente paso
  natural cuando exista un segundo consumidor real.
- Fase 3: favoritos e historial del cliente.
- Capturas antes/después.
- Commits: el árbol de trabajo ya traía decenas de archivos modificados sin commitear, varios
  de ellos tocados aquí; no se hizo commit para no mezclar trabajo previo ajeno.
