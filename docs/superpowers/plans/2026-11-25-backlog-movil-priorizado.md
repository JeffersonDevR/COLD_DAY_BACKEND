# Backlog móvil priorizado — 2026-11-25

Origen: lo que pidió el dueño tras cerrar repuestos por radio y mapas. Alcance: **app móvil** (la web solo si es admin). Cada ítem cita los archivos revisados hoy; los de "Decisión" no se construyen hasta resolverla.

Tamaños: **S** ≈ horas · **M** ≈ 1–2 días · **L** > 2 días o toca backend.

Regla común: cada ítem va con test que falla primero, `npm run ui:check` y suite móvil verdes, y su propio commit `tipo(ámbito): mensaje`.

---

## P0 — Errores visibles que rompen el flujo — ✅ HECHO 2026-11-25

Commits: `7bf5d87` (P0.1), `61930f2` (P0.2), `7ebe196` (P0.3), `147a329` (P0.4).
**P0.4 salió más simple que lo propuesto:** el backend ya define `SIN_TECNICOS_DISPONIBLES` como terminal (`EstadoOt.esTerminal`) y el front lo trataba como activa. Se corrigió esa regla (activa = no terminal) en vez de crear cuatro grupos; `DISPUTADA` sigue activa porque no es terminal. Mis equipos muestra «N en curso». Quedó sin hacer: separar visualmente la lista del panel en bloques Activas / Anteriores.

### P0.1 Técnico: el formulario de presupuesto sigue visible después de enviarlo — **S**
- **Causa:** `mostrarDiagnostico` en `pages/ejecucion-ot/ejecucion-ot.page.ts:119` es `EN_DIAGNOSTICO || (EN_CAMINO && enSitio)`. Al enviar, la OT sigue en `EN_DIAGNOSTICO` hasta que el cliente aprueba, así que el formulario no se va.
- **Arreglo:** si `ot().presupuesto` ya existe, en lugar del formulario mostrar una tarjeta de solo lectura: "Presupuesto enviado — esperando que el cliente lo apruebe", con el diagnóstico, mano de obra, repuestos y total que ya mandó. El formulario solo aparece si no hay presupuesto.
- **Verificar antes de construir:** qué pasa si el cliente rechaza (¿vuelve la OT a poder editar el presupuesto?). Revisar `presupuesto.aprobado` y el caso de rechazo en backend; el formulario debe reaparecer solo en ese caso.
- **Hecho cuando:** enviar el presupuesto oculta el formulario; recargar la pantalla no lo trae de vuelta; test con OT `EN_DIAGNOSTICO` con y sin `presupuesto`.

### P0.2 "Próxima orden de trabajo" → "Orden de trabajo activa" — **S**
- **Dónde:** `pages/panel-tecnico/panel-tecnico.page.html:131` (título) y `panel-tecnico.page.ts:123` (`proximaOt = misOts()[0]`), más el CSS `cd-ot--proxima` / `cd-proxima__*`.
- **Arreglo:** título "Orden de trabajo activa"; las demás de la cola bajo "Otras órdenes". Renombrar `proximaOt` a `otActiva` y las clases `cd-proxima__*` a `cd-activa__*` (un solo commit, con el CSS).
- **Hecho cuando:** ninguna cadena "Próxima orden" en la app móvil (`grep` limpio); specs actualizados.

### P0.3 Quitar "Agregar perfil" de la cuenta — **S**
- **Dónde:** `pages/cuenta/cuenta.page.ts`, bloque `@if (puedeAutoActivar() && faltantes().length > 0)` (líneas ~141–258): el formulario de solicitud, los estados de éxito/duplicado/error y el `SolicitudesPerfilApi` que lo alimenta.
- **Arreglo:** borrar el bloque, su estado (`perfilSolicitado`, `motivacion`, `estadoSolicitud`, etc.) y sus tests. Se queda el selector de modo y "Mi perfil técnico".
- **No tocar:** el backend de solicitudes de perfil ni la página web `agregar-perfil-page` (el dueño pidió solo la sección en la app). Dejar anotado que el endpoint queda sin uso en móvil.
- **Hecho cuando:** `cuenta.page.ts` no menciona `SolicitudesPerfilApi`; `cuenta.page.spec.ts` sin los casos de solicitud; build móvil verde.

### P0.4 Cliente: no se distingue qué OT está activa — **M** (con una decisión)
- **Hoy:** `core/service/ots-cliente.ts` define "activa" como "no FINALIZADA ni CANCELADA". Entran `SIN_TECNICOS_DISPONIBLES` y `DISPUTADA`, que no son trabajo en marcha (se vio en la captura: "Activas" listaba una OT "Sin técnicos"). Además **Mis equipos** (`pages/equipos/equipos.page.ts`) agrupa todas las OT por categoría y solo muestra el estado de la última, sin decir si el equipo tiene algo en curso.
- **Decisión (propuesta mía, confirmar):** separar por lo que el cliente necesita saber:
  - **En curso:** `ASIGNADA`, `EN_CAMINO`, `EN_DIAGNOSTICO`, `EN_REPARACION`.
  - **Buscando técnico:** `SOLICITADA`, `BUSCANDO_TECNICO`.
  - **Requiere tu atención:** `SIN_TECNICOS_DISPONIBLES` (reintentar o cancelar) y `DISPUTADA`.
  - **Cerradas:** `FINALIZADA`, `CANCELADA`.
- **Arreglo:** el filtro "Activas" = En curso + Buscando; las OT "Requieren atención" con su propio acento; la lista del panel en dos bloques ("Activas" / "Anteriores") y, en Mis equipos, un indicador "En curso" cuando el equipo tiene una OT activa. La regla vive en `core` (web y móvil la comparten), con spec.
- **Hecho cuando:** una OT `SIN_TECNICOS_DISPONIBLES` no aparece como "en proceso"; el contador "en proceso" coincide con la lista "Activas"; Mis equipos marca los equipos con OT en curso.

---

## P1 — Documentos (lo que bloquea que técnico y proveedor operen)

**Estado 2026-11-25: P1.1, P1.2 y P1.3 fase A HECHOS** (commits `2f37df9`, `5f33be9`, `279b5a6` y el de proveedor). Se creó un componente de lista y uno de formulario compartidos por técnico y proveedor, y `documentos-vigencia` en `core` (vencido, por vencer a 30 días, vigente). **Pendiente:** P1.3 fase B (backend: expedición, estado y rechazo por documento, migración `V22`) y subir el archivo real (P3.2). Decisiones mías a confirmar: ventana de aviso de 30 días y vencimiento opcional para la empresa.

### P1.1 Técnico: documentos visibles de primeras, liquidaciones en desplegable — **M**
- **Hoy:** `pages/liquidaciones-tecnico/liquidaciones-tecnico.page.html` (la pestaña "Gestión") pone las liquidaciones arriba y los documentos al final, con "Sube o renueva documentos desde la web".
- **Arreglo:** documentos primero, con un aviso destacado si hay alguno vencido, por vencer o rechazado. Las liquidaciones pasan a un `ion-accordion-group` cerrado por defecto; el encabezado del acordeón ya resume ("$ X por consignar · N en verificación") para no esconder el bloqueo por deuda.
- **Ojo:** cuando hay comisión por consignar el técnico no puede tomar servicios; ese aviso **no** puede quedar escondido. Si `porConsignar() > 0`, el acordeón abre solo o muestra el aviso fuera de él.
- **Hecho cuando:** al abrir Gestión lo primero es Documentos; con deuda se ve el aviso sin tocar nada; spec del orden y del acordeón.

### P1.2 Técnico: declarar documentos desde la app — **M**
- **Hoy:** la app solo lista; el texto dice "la carga se hace desde la web". El backend (`POST /api/tecnicos/{id}/documentos`) acepta **tipo, fecha de expedición y vencimiento**, no archivo (`tecnicos-api.ts:384`).
- **Arreglo:** formulario "Declarar documento" en esa misma pantalla, con los tipos existentes (`CEDULA`, `ANTECEDENTES_POLICIA`, `CERTIFICACION_CONTE`, `CERTIFICACION_SENA`, `MATRICULA_CONTE`, `RUT`, `OTRO`) y las dos fechas.
- **Decisión pendiente (L, otro ítem — P3.2):** subir el archivo real (foto o PDF) necesita almacenamiento en el backend; hoy no existe. Mientras tanto la app declara metadatos igual que la web.

### P1.3 Proveedor: la sección documental del técnico, pero de empresa — **L**
- **Hoy:** `pages/documentos-proveedor/` ya existe pero es más pobre que la del técnico: sin estado por documento, sin semáforo, sin fecha de expedición, tipo con 4 opciones fijas. El backend (`GestionarDocumentacionProveedorUseCase`) guarda solo `tipo` y `fechaVencimiento`; la aprobación es del expediente completo.
- **Fase A (solo frontend, **M**):** igualar la experiencia: lista con semáforo calculado por vencimiento (verde / por vencer / vencido), estado de validación del expediente arriba (ya está), aviso de lo que falta, y tipos de empresa. Reutilizar el componente de lista de documentos del técnico, parametrizado (un solo componente compartido, no una copia).
- **Tipos de empresa (propuesta, **confirmar con el negocio**; no invento requisitos legales):** RUT, Cámara de Comercio, cédula del representante legal, certificación bancaria, otro.
- **Fase B (backend, **L**):** fecha de expedición y observaciones por documento, estado por documento, y que el admin pueda rechazar un documento puntual con motivo (hoy rechaza todo el expediente). Va con migración nueva `V22`.
- **Hecho cuando (A):** el proveedor ve el mismo tipo de pantalla que el técnico con textos de empresa; spec del semáforo.

---

## P2 — Repuestos: lo que dejamos a medias

### P2.1 ETA incumplido: sanción y redifusión — **L** (requiere brainstorming)
- **Estado 2026-11-26: HECHO.** Decide el técnico, el incumplimiento solo se registra (sin sanción). Diseño `specs/2026-11-26-eta-incumplido-design.md`, plan `plans/2026-11-26-eta-incumplido.md`. Usa la migración `V22`: la fase B de documentos pasa a `V23`.
- **Hoy:** si el ETA vence sin despacho solo se avisa al técnico por push (`AvisarEtaVencidoUseCase`); el pedido sigue asignado a ese proveedor.
- **Es delicado** (el dueño lo marcó): toca dinero, reputación del proveedor y el tiempo del técnico. Antes de escribir código hay que decidir:
  1. ¿Cuánta gracia tras el ETA antes de actuar?
  2. ¿Qué pasa con el proveedor: aviso, contador de incumplimientos, bloqueo temporal?
  3. ¿El pedido vuelve a `SOLICITADO` y se rebroadcastea (excluyendo al que incumplió) o el técnico decide?
  4. ¿Se puede desasignar si el proveedor ya despachó pero llega tarde?
- **Camino propuesto:** una sesión de diseño corta con esas 4 preguntas, luego plan propio. No se mezcla con el resto.

### P2.2 Proveedor sin ubicación no recibe solicitudes — **S/M**
- **Estado 2026-11-26: compuerta HECHA** en móvil. Sin ubicación no se gestiona la bandeja, salvo que haya un pedido aceptado sin entregar. **Pendiente:** confirmar los valores `app.insumos.*`.
- Los proveedores existentes deben fijar su ubicación; hoy solo hay un banner. Propuesta: bloquear el acceso a Solicitudes con una pantalla "Fija tu ubicación para recibir pedidos" hasta que la fije.
- Y confirmar con el negocio los valores por defecto de `app.insumos.*` (velocidad, tope del ETA, radios, ventanas): hoy no son política de producto.

---

## P3 — Rediseño de la UI

### P3.1 "La veo insípida, como si faltara algo" — **L** (diagnóstico antes de diseñar)
- **No se rediseña a ciegas.** El sistema ya tiene reglas (`DESIGN.md`, `PRODUCT.md`) y un verificador; una paleta oscura con tarjetas casi iguales entre sí suele sentirse plana por falta de jerarquía, no por falta de color. Hipótesis a validar, no conclusiones:
  - Todas las tarjetas pesan lo mismo; no hay una acción o dato dominante por pantalla.
  - Poco uso de iconografía, ilustración o datos clave grandes (distancia, ETA, monto).
  - Estados vacíos y de carga sin personalidad.
- **Plan:** (1) auditar 5 pantallas clave con capturas reales (Panel cliente, Panel técnico, Seguimiento de OT, Ejecución de OT, Gestión); (2) proponer 2–3 direcciones concretas, con mockups, dentro o fuera de la paleta actual; (3) el dueño elige; (4) se aplica pantalla por pantalla con el verificador.
- **Necesito de él:** capturas de lo que más le molesta, referencias de apps que le gusten y si la paleta puede cambiar.
- **Va después de P0–P1** para no rediseñar pantallas que acaban de cambiar de estructura.

### P3.2 Subida real de documentos (archivo o foto) — **L**
- Falta almacenamiento de archivos en el backend (el DTO ni siquiera acepta `archivoUrl`). Es una decisión de infraestructura (¿dónde se guardan, qué tamaño, quién puede verlos?), no solo de pantalla. La app ya tiene `MobileCameraService` para la cámara.

---

## Orden de ejecución propuesto

1. **P0.1 → P0.2 → P0.3** (pequeños, independientes, un commit cada uno).
2. **P0.4** (con la decisión de estados confirmada).
3. **P1.1 → P1.2** (la misma pantalla) y luego **P1.3 fase A**.
4. **P2.2** y la **sesión de diseño de P2.1**.
5. **P3.1** (auditoría y direcciones) en paralelo con el diseño de P2.1; aplicar al final.
6. **P1.3 fase B** y **P3.2** cuando haya decisión de backend.

## Fuera de este backlog (ya anotado en otros documentos)

- Deuda técnica: `docs/informe-deuda-tecnica-2026-11-25.md` (gate de tests en el despliegue, `@PreAuthorize`, paginación).
- Mapas: web con Google directo, `MapboxMotor` y adaptador de backend — `docs/pendientes.md` §2.6.
