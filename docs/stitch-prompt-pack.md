# Stitch Prompt Pack — COLD DAY (Ionic mobile revamp)

Creado 2026-10-26. Para usar: pegá 1 prompt por pantalla en Google Stitch (importante: 1 pantalla por generación, no mezclar). Decisión ya tomada: estética **Ionic native** (bottom tabs, componentes estándar), **sin panel admin** (queda en Angular web). Paleta actual se mantiene (cambio futura).

## Sistema global (pegar como contexto al inicio de la primera generación, si Stitch permite "app theme")

- **Style**:Ionic-native mobile app. Clean cards on light background, bold headings, generous touch targets (min 44px), bottom tab bar, pull-to-refresh, skeleton loading states, friendly Spanish copy (voseo argentino suave).
- **Colors**: primary `#0284c7` (blue, main actions/links), attention `#f59e0b` (payments/CTA pay), tertiary `#7c3aed` (parts/repuestos), background `#f8fafc`, surface `#ffffff`, text `#0f172a`, muted `#64748b`, border `#e2e8f0`, danger `#dc2626`, success `#16a34a`.
- **Status chips** (semicírculo, uppercase, según estado de la orden): `SOLICITADA` (slate), `BUSCANDO_TECNICO` (amber pulse), `ASIGNADA` (blue), `EN_CAMINO` (blue), `EN_DIAGNOSTICO` (violet), `EN_REPARACION` (violet), `FINALIZADA` (green), `CANCELADA` (red), `DISPUTADA` (red outline), `SIN_TECNICOS_DISPONIBLES` (red).
- **Every screen must show 4 states**: loading (skeleton, not spinner), empty (illustration + 1 CTA), error (card with human Spanish copy + "Reintentar", never raw HTTP text), success (toast).
- **Navigation**:
  - Role switcher: header chip with the active profile ("Cliente"/"Técnico"/"Proveedor"), tap → action sheet to switch/add profile ("Agregar perfil de cliente", "Agregar perfil de técnico").
  - Cliente tabs: `Inicio` · `Mis equipos` · `Solicitar` (FAB) · `Perfil`.
  - Técnico tabs: `Radar` · `Mis OTs` · `Perfil`.
  - Proveedor tabs: `Solicitudes` · `Documentos` · `Perfil`.

---

## A. CLIENTE (primero)

### A1 · Login  → `POST /api/login` → {token, expiracion, rol, roles} (sin nombre)
**Prompt**: iOS-style login screen for a home-services app ("COLD DAY" — refrigeración y asistencia técnica a domicilio). Logo placeholder top, email + password fields in rounded cards, primary blue "Ingresar" button, link "¿Olvidaste tu contraseña?" and "Crear cuenta" at bottom. Below: subtle illustration of a technician over a washing machine. Error state: red inline banner "Correo o contraseña incorrectos". Show loading state on button (spinner inside, disabled).

### A2 · Registro → públicos: `POST /api/clientes|tecnicos|proveedores` + `POST /api/login`
**Prompt**: Registration screen, segmented control at top: "Cliente / Técnico / Proveedor" (segment switches the form fields below, same layout). Common: nombre, correo, contraseña. Cliente: dirección de casa. Técnico: oficio/categoría (dropdown: REFRIGERACION, LAVADORAS, COCINAS, etc.), años de experiencia, radio de trabajo en km. Proveedor: NIT, razón social. Primary button "Crear cuenta". Compact trust line at bottom already has Google/Apple? No — single email/password only. Inline field errors in Spanish.

### A3 · Agregar perfil / cambiar rol  → `POST /api/clientes/perfil` etc.
**Prompt**: Settings sheet ("Mi cuenta") listing the user's modes as cards: "Cliente", "Técnico", "Proveedor" with a checkmark for active; CTA at the bottom "Agregar perfil de cliente/técnico" for the missing ones. A short explainer line: "El mismo usuario puede actuar como cliente y como técnico; elegí con qué modo abrir la app." Empty state when no mode yet.

### A4 · Panel cliente (Inicio)  → `GET /api/clientes/me/ots` (+ filtros del panel ya en el front)
**Prompt**: Home dashboard for a client. Top: greeting bar "Bienvenido" + active-mode chip. Metrics row (3 stat cards): Activas, Completadas, Sin técnico. Then segmented filter chips: Todas / Activas / Completadas / Sin técnico (does NOT change the metric counters). List of order cards: service category icon, short fall description, footer with: state chip, fecha, presupuesto total if approved. Pull-to-refresh. Tapping a card goes to tracking. Empty state for zero orders: illustration "Contá a tu primer servicio" + big FAB-like CTA.

### A5 · Solicitar servicio (FAB)  → `POST /api/ot` + Maps address + `PUT /api/clientes/me/ubicacion`
**Prompt**: Full-screen request flow, 3 steps with progress dots. Step 1: full-screen map with center pin and search field using address autocomplete over the map; bottom sheet with mini-map. Step 2: form — category (chips grid), description of the fall (textarea), optional photos (icon only, disabled with "próximamente"). Step 3: summary card (category, dirección, estimated fee banner) + big amber button "Solicitar técnico". Error card when the account has no client profile yet: "Falta crear tu perfil de cliente" with button "Crear perfil ahora" (this maps to the B5 fix).

### A6 · (OT) Seguimiento  → `GET /api/ot/{id}` + SSE `/api/ot/{id}/stream` + poll 25 s + `GET .../tecnico-ubicacion`
**Prompt**: Order tracking screen. Top: state chip + short "distancia y ETA" banner when technician is en route. Middle: map card (full-width) with two markers — client pin (static) and technician marker that moves; below the map a straight dashed line to it. Under: horizontal timeline of events (Historial: created, táctica accepted, on the way, arrived, diagnosis, warranty...) with timestamps. Cards for: assigned technician (name, rating, call button placeholder), presupuesto (if sent: azul línea breakdown + amber buttons "Aprobar presupuesto" / "Rechazar"), visit payment ("Pagando visita" amber CTA, hidden if already paid), garantie courus. Polling indicator "actualizando…". Special empty banner when `BUSCANDO_TECNICO` or `SIN_TECNICOS_DISPONIBLES`: ".buscar ampliando el radio" state with optimistic copy. Cancel action in overflow menu with confirm sheet.

### A7 · (OT) Diagnóstico y presupuesto  → payload de la OT; `POST .../presupuesto/aprobar|rechazar`
**Prompt**: Budget review screen: diagnosis card (text), line-items list — mano de obra, repuestos (each with description), total highlighted in blue. Two big actions bottom: "Aprobar presupuesto" (primary blue) and "Rechazar" (outline red with confirm sheet + reason input). Above the items, subtle banner: "El chat de diagnóstico llega en una próxima versión" (chat is out of scope — do NOT design a fake chat). Loading/success toasts after each action.

### A8 · (OT) Pago y acta  → `POST .../pagar-visita`, `POST .../acta` (firma + comprobante)
**Prompt**: Payment & warranty screen for a finished service. Status list: payment of technician visit, warranty acta. Fusion of steps: if the visit is not paid — amber card "Pago de visita" with pay button; if the visit is paid — green check row. Follows with the acta card: summary of the completed service (total, warranty lines) + a signature pad box (finger-drawn area with caption "Firma aquí", obviously bounded) + primary button "Firmar y aceptar". Include a small note that the signature is required. No pre-filled values anywhere.

### A9 · (OT) Calificar  → `POST /api/ot/{id}/calificar`
**Prompt**: Rate service screen: big star row, initial 0 (no pre-selection), quick tags for "Fase del paso: puntual", "("LABEL - in-place translation): "Resolvió el problema", "Buen trato", "Limpieza", selectable chips; optional textarea comment. Button "Enviar calificación". After submit: success screen with a thank-you illustration.

---

## B. TÉCNICO (segundo)

### B1 · Radar de ofertas  → `GET /api/tecnicos/me/ofertas` + SSE `/api/tecnicos/me/ofertas/stream`
**Prompt**: Radar of available orders for a technician. Top: live toggle chip "En vivo" (SSE) + radius info "buscando en 25 km". Feed of offer cards: service category icon, neighborhood/distance estimate, urgency time badge (countdown "vence en 4:00" uses the offer expiry), and a big blue button "Aceptar orden". Cards animate gently when a new offer arrives (slide-in). Accept → confirm sheet; on losing a race show friendly toast "La tomó otro técnico antes". Empty state: calm radar illustration "Sin ofertas por ahora, seguimos mirando". Clean separation: these are broadcasts — copy line says "El primer técnico que acepta, gana".

### B2 · Mis OTs (panel técnico)  → `GET /api/tecnicos/me/ots` + location report toggle
**Prompt**: Technicians active orders list: order cards grouped as "En curso" / "Por iniciar" with state chips, mini-map thumbnail, next action hint ("Ir a ejecución"). Top row includes a switch card "Reportar mi ubicación" with helper copy ("Aparecés en el radar de los clientes cuando está prendido"). Pull-to-refresh + manual reload button.

### B3 · (OT) Ejecución  → desplazamiento/llegada/diagnóstico/repuestos/finalizar + SSE OT stream
**Prompt**: Technician execution screen for one order, section-based scroll:
1. Header: client name, address, state chip, "Aviso: al cliente le llega" mini-line.
2. Map banner with straight-line route + local ETA "≈ 20 min" (no Google calls chip).
3. Actions sequence (disabled with reasons): "Iniciar desplazamiento" → "Llegué" (only when en route) → then forms.
4. Diagnosis form: diagnostic textarea + grid fields (mano de obra, horas) with empty defaults; "Líneas de repuestos" local add (+) list; summary auto-calc; submit "Enviar diagnóstico y presupuesto" (amber).
5. Later: "Repuestos a posteriori" section (violet accent) listing past part requests with states (SOLICITADO / ASIGNADO / ENTREGADO / SIN_PROVEEDOR→"reintentar") + form to add more lines (violet).
6. Bottom: "Finalizar servicio" with liquidation summary card.
 firefighter In-flight states double-click safe (disable button while sending). Human error toasts; never raw text.

### B4 · Perfil técnico y documentos  → GET/PUT `/api/tecnicos/me*`, agregación de documento, `estadoValidacion`
**Prompt**: Profile screen: header with avatar, name, status switch (Disponible/Ocupado), rating, category chips. Documents section: list of submitted documents with status badges (PENDIENTE/VALIDADO/RECHAZADO +Rejected reason banner if any), add button leading to an upload form (type selector, number, date) with a note "cargar una foto del documento (próximamente archivo real)". Show `estadoValidacion` banner state too.

---

## C. PROVEEDOR (último)

### C1 · Solicitudes de repuestos  → `GET /api/proveedores/me/solicitudes` + aceptar/rechazar/entregar
**Prompt**: Supplier requests feed (insumos). Card: request ID short, time since creation, expiry countdown ring ("vence en 3:20"), items list (part description + cantidad), chip state (PENDIENTE/ASIGNADO/ENTREGADO/RECHAZADO/EXPIRADA). Actions per state: PENDIENTE: "Aceptar" (blue) / "Rechazar" (ghost); ASIGNADO (winner): "Confirmar entrega" (violet). Race-loss toast "Otro proveedor tomó esta solicitud". Top has manual reload button + pull-to-refresh. Empty state clipboard illustration.

### C2 · Documentos del proveedor  → documentos propio + `estadoValidacion`
**Prompt**: Supplier documents screen: compliance progress header (" estados" with validation state banner: VALIDADO/pendiente/rechazado), list of existing documents with badges, CTA "Agregar documento" (form sheet: type, number, expiry date; photo upload placeholder). Rejected docs show the admin's motive in a red banner.

---

## Fuera de alcance (no generar en Stitch)
- Todo el panel **admin** (dashboar, validación, consignaciones, disputas, monitoreo, proveedores) — sigue web.
- Chat de diagnóstico, upload real de archivos, pedido directo de técnico, push notifications (badge placeholder ok, FCM después).
