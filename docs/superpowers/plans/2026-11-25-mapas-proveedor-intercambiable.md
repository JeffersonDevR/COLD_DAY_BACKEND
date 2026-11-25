# Mapas con proveedor intercambiable — Plan de implementación

> **Para agentes:** REQUIRED SUB-SKILL: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan casillas `- [ ]`.

**Goal:** que el mapa móvil y la geocodificación del cliente hablen con un contrato propio ("motor de mapa") y no con `google.maps`, de modo que cambiar a Mapbox sea escribir un motor nuevo.

**Architecture:** una clase abstracta `MapaMotor` en `core/maps` (cargar, reintentar, crear mapa, estado) con un único motor hoy: `GoogleMotor`, que envuelve el `GoogleMapsLoaderService` existente. Un `InjectionToken` `MAPA_MOTOR` elige el motor según `proveedor` de `GET /api/config/maps` (por defecto `google`). El componente móvil de seguimiento pasa a describir una "escena" (marcadores y líneas) y el motor la dibuja. El decodificador de polyline pasa a ser JS puro (ya no depende de `google.maps.geometry`).

**Tech Stack:** Angular 21 (zoneless, signals), Ionic 9, Vitest, alias `@core/*`.

**Spec:** `docs/superpowers/specs/2026-11-25-mapas-proveedor-intercambiable-design.md`

## Global Constraints

- **Alcance:** `frontend/src/app/core` y `frontend/projects/mobile`. La web (`shared/mapa-radar`, `shared/mapa-seguimiento`, `shared/selector-ubicacion-mapa`) **no se toca** (decisión del usuario: solo admin en web, y admin no usa mapas). Siguen usando `GoogleMapsLoaderService` y `decodificarRuta` tal cual.
- Cero cambios visibles: mismos colores, marcadores, línea, zoom y restricción a los límites que publica el backend.
- No tocar `backend/`. No instalar dependencias. No quitar Google.
- Copy en tuteo, es-CO. El texto "No pudimos cargar Google Maps…" del fallback pasa a ser neutro ("el mapa").
- Verificadores: `cd frontend && npm run ui:check` antes y después; sin subir techos ni editar `ui-rules.baseline.json`.
- Commits `tipo(ámbito): mensaje` en español, con el trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. No añadir archivos sin seguimiento ajenos (`git add` con rutas explícitas).
- Sin `it.skip`, `@Disabled`, `eslint-disable`.

## Review Focus

- El script del proveedor no carga (sin key, sin red): `listo` queda en `false`, `cargando` en `false`, el móvil muestra la tarjeta "Mapa no disponible" con "Reintentar mapa" y el resto de la pantalla sigue.
- Polyline vacío, nulo o corrupto: la línea cae a la recta técnico→destino, nunca rompe.
- `proveedor` ausente o desconocido en la config: se usa Google, sin error.
- Angular recrea el nodo del canvas (alterna estado vacío): la instancia anterior se destruye y no quedan marcadores ni líneas colgando.
- Sin posición del técnico: no hay marcadores ni línea; no se inventa nada.

---

### Task 1: Contrato del motor y decodificador de polyline neutro

**Files:**
- Create: `frontend/src/app/core/maps/mapa-motor.ts`
- Create: `frontend/src/app/core/maps/polyline.ts`
- Test: `frontend/src/app/core/maps/polyline.spec.ts`

**Interfaces:**
- Consumes: nada.
- Produces (`mapa-motor.ts`):
  - `interface Coordenada { lat: number; lng: number }`
  - `interface LimitesMapa { north: number; south: number; east: number; west: number }`
  - `type EstiloMarcador = 'tecnico' | 'destino'`
  - `interface MarcadorSpec { id: string; posicion: Coordenada; titulo: string; estilo: EstiloMarcador }`
  - `interface LineaSpec { id: string; puntos: Coordenada[] }`
  - `interface EscenaMapa { marcadores: MarcadorSpec[]; lineas: LineaSpec[] }`
  - `interface MapaOpciones { centro: Coordenada; zoom: number; zoomMin: number; zoomMax: number; limites: LimitesMapa }`
  - `interface MapaInstancia { actualizar(escena: EscenaMapa): void; ajustarA(puntos: Coordenada[], margenPx: number): void; centrarEn(centro: Coordenada): void; destruir(): void }`
  - `abstract class MapaMotor { abstract readonly nombre: string; abstract readonly listo: Signal<boolean>; abstract readonly cargando: Signal<boolean>; abstract cargar(): Promise<boolean>; abstract reintentar(): Promise<boolean>; abstract crear(el: HTMLElement, opciones: MapaOpciones): MapaInstancia }`
- Produces (`polyline.ts`): `decodificarPolyline(codificada: string | null | undefined): Coordenada[] | null` — algoritmo estándar de polyline de precisión 5; `null` si es vacío, malformado o produce menos de 2 puntos.

- [ ] **Step 1: Escribir el spec que falla** (`polyline.spec.ts`)
  - `decodifica el ejemplo de la documentación de Google`: la cadena `_p~iF~ps|U_ulLnnqC_mqNvxq` seguida de un acento grave y `@` (en el spec se escribe con escape: `'_p~iF~ps|U_ulLnnqC_mqNvxq`@'`) decodifica a los puntos `(38.5,-120.2)`, `(40.7,-120.95)`, `(43.252,-126.453)`; compara con `toBeCloseTo(…, 5)`.
  - `devuelve null para null, undefined y cadena vacía`.
  - `devuelve null si la cadena está truncada` (`'_p~iF~ps|U_ulLnnq'`).
  - `devuelve null si solo hay un punto` (`'_p~iF~ps|U'`).
- [ ] **Step 2: Verlo fallar**
  Run: `cd frontend && npx ng test app --watch=false --include='**/core/maps/polyline.spec.ts'`
  Expected: FAIL (módulo no existe).
- [ ] **Step 3: Crear `mapa-motor.ts`** con exactamente las interfaces de arriba (solo tipos y la clase abstracta; `Signal` de `@angular/core`).
- [ ] **Step 4: Implementar `decodificarPolyline`** en `polyline.ts` con el algoritmo estándar (desplazamientos de 5 bits, deltas acumulados, `/1e5`). Una cadena truncada o con un par lat sin lng devuelve `null` (envolver en try y validar que consumió toda la cadena).
- [ ] **Step 5: Ver pasar**
  Run: el mismo comando. Expected: PASS (4 tests).
- [ ] **Step 6: Commit**
  ```bash
  git add frontend/src/app/core/maps/mapa-motor.ts frontend/src/app/core/maps/polyline.ts frontend/src/app/core/maps/polyline.spec.ts
  git commit -m "feat(frontend): contrato del motor de mapa y decodificador de polyline neutro"
  ```

---

### Task 2: `proveedor` en la configuración del mapa

**Files:**
- Modify: `frontend/src/app/core/service/mapa-config.service.ts`
- Test: `frontend/src/app/core/service/mapa-config.service.spec.ts` (crear si no existe; si existe, añadir)

**Interfaces:**
- Consumes: nada de la Task 1.
- Produces: `MapaConfigService.proveedor: Signal<string>` — normalizado a minúsculas y recortado; vale `'google'` si el backend no lo manda, viene vacío o el backend no responde. `ConfigMapaApiResponse` gana `proveedor?: string | null`.

- [ ] **Step 1: Test que falla.** Con `HttpTestingController` (o el stub de `HttpClient` que use el spec vecino): (a) respuesta `{ proveedor: ' Mapbox ' }` → `proveedor()` es `'mapbox'`; (b) respuesta sin campo → `'google'`; (c) error de red → `'google'`.
- [ ] **Step 2:** Run `npx ng test app --watch=false --include='**/mapa-config.service.spec.ts'` → FAIL.
- [ ] **Step 3: Implementar** `readonly proveedor = signal<string>('google')` y fijarlo en `cargarDesdeBackend` junto a `apiKey` (solo si el valor recortado no está vacío).
- [ ] **Step 4:** mismo comando → PASS.
- [ ] **Step 5: Commit** `feat(frontend): la config del mapa publica el proveedor` (añadir solo los dos archivos).

---

### Task 3: Motor Google y token `MAPA_MOTOR`

**Files:**
- Create: `frontend/src/app/core/maps/google-motor.ts`
- Create: `frontend/src/app/core/maps/mapa-motor.token.ts`
- Test: `frontend/src/app/core/maps/google-motor.spec.ts`, `frontend/src/app/core/maps/mapa-motor.token.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`MapaMotor` y tipos), Task 2 (`MapaConfigService.proveedor`), `GoogleMapsLoaderService` (`isLoaded`, `isLoading`, `init()`, `reintentar()`), `MAPA_ESTILOS`.
- Produces:
  - `@Injectable({ providedIn: 'root' }) class GoogleMotor extends MapaMotor` con `nombre = 'google'`; `listo`/`cargando` son `computed` sobre `loader.isLoaded` / `loader.isLoading`; `cargar()` = `loader.init()`; `reintentar()` = `loader.reintentar()`.
  - `GoogleMotor.crear(el, opciones)` devuelve una `MapaInstancia` que replica **exactamente** lo que hoy hace `MapaSeguimientoComponent.sincronizarMapa`:
    - `new google.maps.Map(el, { zoom, minZoom: zoomMin, maxZoom: zoomMax, streetViewControl: false, mapTypeControl: false, fullscreenControl: false, zoomControl: true, styles: MAPA_ESTILOS, restriction: { latLngBounds: limites, strictBounds: true }, center: centro })`.
    - Marcadores `google.maps.Marker` con icono `SymbolPath.CIRCLE`, `scale: 8`, `fillOpacity: 1`, `strokeWeight: 2`: `tecnico` → fill `#22d3ee`, stroke `#04121a`, `zIndex: 2`; `destino` → fill `#f59e0b`, stroke `#1a1204`, `zIndex: 1`. Se reutilizan por `id` (se mueve, no se recrea) y los ausentes de la escena se quitan con `setMap(null)`.
    - Líneas `google.maps.Polyline` color `#22d3ee`, opacidad `0.9`, grosor `3`; con menos de 2 puntos se quitan.
    - `ajustarA(puntos, margenPx)` → `fitBounds` con un `LatLngBounds` extendido por los puntos; `centrarEn` → `setCenter`; `destruir()` → quita todo y suelta el mapa.
  - `MAPA_MOTOR: InjectionToken<MapaMotor>` con `providedIn: 'root'` y fábrica que lee `inject(MapaConfigService).proveedor()`: `'google'` y cualquier otro valor desconocido → `inject(GoogleMotor)`.

- [ ] **Step 1: Specs que fallan.**
  - `google-motor.spec.ts`: instalar un `window.google.maps` falso mínimo (`Map`, `Marker`, `Polyline`, `LatLngBounds`, `SymbolPath.CIRCLE`) y un `GoogleMapsLoaderService` stub con señales. Casos: `crear` pinta marcador técnico con el fill `#22d3ee`; `actualizar` con el mismo `id` y otra posición llama `setPosition` y no crea otro marcador; un marcador que desaparece de la escena recibe `setMap(null)`; una línea de 1 punto no se dibuja y la de 2 sí; `ajustarA` llama `fitBounds` con el margen; `destruir` quita marcadores, línea y mapa; `listo()` refleja `loader.isLoaded()`; `reintentar()` delega en el loader.
  - `mapa-motor.token.spec.ts`: con `proveedor` `'google'` → `inject(MAPA_MOTOR)` es el `GoogleMotor`; con `'mapbox'` (aún sin motor) y con `''` → también `GoogleMotor`.
- [ ] **Step 2:** Run `npx ng test app --watch=false --include='**/core/maps/*.spec.ts'` → FAIL.
- [ ] **Step 3: Implementar** `GoogleMotor` y el token según las firmas de arriba. `google.maps.*` solo se referencia dentro de `google-motor.ts`.
- [ ] **Step 4:** mismo comando → PASS.
- [ ] **Step 5: Commit** `feat(frontend): motor Google y token MAPA_MOTOR detrás del contrato de mapa` (los 4 archivos).

---

### Task 4: El mapa móvil usa el motor

**Files:**
- Modify: `frontend/projects/mobile/src/app/pages/seguimiento-ot/mapa-seguimiento.component.ts`
- Modify: `frontend/projects/mobile/src/app/pages/seguimiento-ot/seguimiento-ot.page.spec.ts` (solo si algún caso necesita ajuste)

**Interfaces:**
- Consumes: `MAPA_MOTOR`, `MapaMotor`, `MapaInstancia`, `EscenaMapa`, `decodificarPolyline` (Tasks 1–3), `MapaConfigService`, `rutaLocal`.
- Produces: el mismo selector `app-mapa-seguimiento`, mismos inputs (`posicionTecnico`, `destino`, `destinoNombre`, `tecnicoNombre`, `llegada`, `rutaCodificada`), mismos `data-testid` (`mapa-canvas`, `mapa-sin-posicion`, `mapa-cargando`, `mapa-fallback`, `mapa-reintentar`, `mapa-resumen`, `mapa-distancia`, `mapa-llegada`). Ya no importa `GoogleMapsLoaderService`, `decodificarRuta`, `MAPA_ESTILOS` ni usa `google.maps`.

- [ ] **Step 1: Línea base.** Run `cd frontend && npx ng test mobile --watch=false --include='**/seguimiento-ot.page.spec.ts'` → PASS (registrar el conteo).
- [ ] **Step 2: Test que falla** (en `seguimiento-ot.page.spec.ts`): con un `MapaMotor` falso inyectado por `MAPA_MOTOR` (señales `listo`/`cargando`, `crear` que devuelve una instancia espía), verificar que con posición del técnico y destino el componente llama `actualizar` con **dos** marcadores (`tecnico`, `destino`) y una línea con los puntos del polyline cuando `rutaCodificada` es válido, y con la recta de 2 puntos cuando es `'basura'`; que `ajustarA` se llama una sola vez al primer par; que sin posición no se llama `crear`.
- [ ] **Step 3:** Run el mismo comando → FAIL.
- [ ] **Step 4: Migrar el componente.** Inyectar `MAPA_MOTOR` como `motor`; en la plantilla usar `motor.listo()`, `motor.cargando()` y `reintentar()` → `motor.reintentar()`; reemplazar el cuerpo de `sincronizarMapa` por: crear la instancia con `motor.crear(el, { centro, zoom, zoomMin: zoom - 2, zoomMax: 18, limites })` (valores de `MapaConfigService`), construir la `EscenaMapa` (ids `tecnico` y `destino`; línea `ruta` con `decodificarPolyline(...) ?? [tecnico, destino]`), llamar `instancia.actualizar(escena)`, y conservar la lógica de `limitesAjustados` usando `instancia.ajustarA([tecnico, destino], 48)` / `instancia.centrarEn(centro)`. `descartarMapa()` llama `instancia.destruir()`. El texto del fallback pasa a: "No pudimos cargar el mapa en esta sesión (puede ser la conexión o la configuración de la clave). La distancia y la ETA siguen visibles acá abajo." Borrar las funciones `opcionesMarcadorTecnico/Destino`.
- [ ] **Step 5: Ver pasar** Run `npx ng test mobile --watch=false --include='**/seguimiento-ot.page.spec.ts'` → PASS, sin bajar el conteo de la línea base; si algún caso existente depende del texto "Google Maps", actualizarlo al nuevo copy y explicarlo en el commit.
- [ ] **Step 6: Commit** `refactor(mobile): el mapa de seguimiento usa el motor de mapa y no google.maps` (los dos archivos).

---

### Task 5: Geocodificador del cliente detrás de su interfaz

**Files:**
- Create: `frontend/src/app/core/maps/geocodificador.ts`
- Modify: `frontend/src/app/core/service/maps-geocoder-cliente.ts`
- Modify: `frontend/src/app/core/service/maps-api.ts`
- Test: `frontend/src/app/core/service/maps-api.spec.ts`, `frontend/src/app/core/service/maps-geocoder-cliente.spec.ts`

**Interfaces:**
- Consumes: `DireccionApiResponse`, `SugerenciaApiResponse` (`core/models/backend.dto`), `Point`.
- Produces: `abstract class GeocodificadorCliente { abstract autocompletar(input: string, sesgo?: Point): Observable<SugerenciaApiResponse[]>; abstract geocodificar(direccion: string): Observable<DireccionApiResponse>; abstract inversa(lat: number, lng: number): Observable<DireccionApiResponse> }` en `geocodificador.ts`. `MapsGeocoderCliente` pasa a `extends GeocodificadorCliente`. `MapsApi` inyecta `GeocodificadorCliente` en lugar de `MapsGeocoderCliente`. Registro: `{ provide: GeocodificadorCliente, useExisting: MapsGeocoderCliente }` como `providedIn: 'root'` mediante un `InjectionToken` o proveedor en `app.config` (usar la misma vía que ya usan los servicios del core; si no hay un sitio común, `GeocodificadorCliente` con `@Injectable({ providedIn: 'root', useExisting: MapsGeocoderCliente })`).

- [ ] **Step 1: Test que falla.** En `maps-api.spec.ts` cambiar el `provide: MapsGeocoderCliente` por `provide: GeocodificadorCliente` y verificar que los casos de fallback siguen pasando con el stub; en `maps-geocoder-cliente.spec.ts` añadir un caso `es un GeocodificadorCliente` (`instanceof`).
- [ ] **Step 2:** Run `npx ng test app --watch=false --include='**/{maps-api,maps-geocoder-cliente}.spec.ts'` → FAIL.
- [ ] **Step 3: Implementar** según las firmas de arriba; sin cambiar el comportamiento del geocodificador de Google.
- [ ] **Step 4:** mismo comando → PASS.
- [ ] **Step 5: Commit** `refactor(frontend): MapsApi depende de GeocodificadorCliente y no de Google` (los 5 archivos).

---

### Task 6: Verificación final y cierre en docs

**Files:**
- Modify: `docs/superpowers/specs/2026-11-25-mapas-proveedor-intercambiable-design.md` (nota de alcance)
- Modify: `docs/pendientes.md` (deuda declarada)

- [ ] **Step 1:** Run `cd frontend && npm run ui:check`. Expected: OK, ninguna regla "SUBIÓ".
- [ ] **Step 2:** Run `npx ng test mobile --watch=false`. Expected: toda la suite móvil en verde.
- [ ] **Step 3:** Run `npx ng test app --watch=false`. Expected: toda la suite web en verde (la web no cambió; confirma que no se rompió nada del core compartido).
- [ ] **Step 4:** Run `npm run mobile:build`. Expected: compila.
- [ ] **Step 5: Docs.** En el diseño, bajo "Pasos", anotar: "Alcance real: core + móvil. La web (`mapa-radar`, `mapa-seguimiento`, `selector-ubicacion-mapa`) sigue con `@angular/google-maps` por decisión del usuario; migrarla es un trabajo aparte." En `docs/pendientes.md` añadir una sección con tres deudas: migrar los tres componentes web al motor; implementar `MapboxMotor` + `MapboxMapsAdapter` en backend; evaluar Mapbox con direcciones de Cúcuta, costos vigentes y WebGL en el WebView de Android.
- [ ] **Step 6: Commit** `docs(mapas): alcance real y deudas del motor de mapa intercambiable` (los dos archivos).
