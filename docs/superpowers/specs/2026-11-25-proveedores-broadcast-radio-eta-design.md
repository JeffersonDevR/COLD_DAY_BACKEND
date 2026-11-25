# Proveedores: difusión por radio, ETA y despacho de repuestos

Fecha: 2026-11-25 · Estado: borrador para aprobación · Alcance: backend + app móvil (proveedor y técnico). Web admin fuera de alcance.

## Intención y porqué

Cuando el técnico presupuesta (diagnóstico) o pide repuestos a posteriori, la solicitud debe llegar a los proveedores **de forma justa**, como las OT llegan a los técnicos: todos los elegibles cercanos la reciben a la vez y gana el primero que acepta. Al aceptar, el proveedor se compromete con un **estimado en minutos según la distancia** y luego **despacha** el pedido. El técnico ve ese estimado y sabe cuándo llegan las piezas.

## Estado actual (ya existe, se reutiliza)

- `SolicitarInsumoUseCase` crea `RequerimientoInsumo` + una `OfertaInsumo` por proveedor activo y notifica por `NotificacionInsumoPort`. Lo invocan `RegistrarDiagnosticoUseCase` (presupuesto) y `SolicitarInsumosOtUseCase` (`POST /api/ot/{id}/insumos`).
- `AceptarInsumoUseCase`: primero en aceptar gana (UPDATE condicional), el resto pasa a `CANCELADA`. Exige proveedor activo y documentación validada.
- `ExpirarInsumosUseCase` + `ProgramadorExpiracionInsumo`: vigencia 15 min (`app.insumos.vigencia-ms`), luego `SIN_PROVEEDOR` (reintentable).
- `EntregarInsumoUseCase`: `ASIGNADO -> ENTREGADO`, solo el proveedor ganador.
- `Proveedor.ubicacion` (Point) ya existe. Las OT ya tienen la consulta espacial `buscarDisponiblesEnRadio`, el escalado `EscalarRadioUseCase` (10→15→20→25 km) y FCM (`FcmNotificacionPushAdapter`).
- Móvil: `solicitudes-proveedor.page`, `documentos-proveedor.page`, sección Repuestos en `ejecucion-ot`.
- Migraciones: la última es V20; se crea V21 (Flyway append-only).

## Objetivos

1. La solicitud se difunde solo a proveedores elegibles (activos y validados) dentro de un radio que empieza en 10 km y escala 5 km por ventana hasta 25 km; sin nadie en 25 km → `SIN_PROVEEDOR`.
2. Al aceptar, el proveedor fija un ETA en minutos (sugerido por el backend a partir de la distancia, ajustable dentro de un tope).
3. Nuevo paso «Despachar»: `ASIGNADO -> DESPACHADO -> ENTREGADO`.
4. El técnico recibe push y refleja en la app el ETA y el estado (aceptado, despachado, entregado).
5. El proveedor recibe push real (FCM) al abrirse una solicitud a su alcance.

## No-objetivos

- Ruta real/tráfico (Google Directions). Distancia en línea recta con PostGIS.
- Catálogo de insumos (siguen siendo líneas libres) y selección de piezas desde catálogo.
- Precios/cotización por proveedor o competencia por precio; gana el primero en aceptar.
- Seguimiento en vivo del proveedor en mapa.
- Cambios en la web admin; cambios en el ciclo de vida de la OT (la solicitud sigue siendo un root aparte que nunca bloquea la OT).

## Anti-objetivos (fracaso aunque «funcione»)

- Que un proveedor lejano prometa un ETA irreal y desplace a uno cercano (por eso el radio y el tope del ETA).
- Que una carrera de dos aceptaciones deje dos ganadores.
- Que un fallo de push cambie el estado persistido (el envío sigue siendo best-effort, después de escribir).

## Restricciones

- Reglas del repo: `docs/backend/GUIA-BACKEND.md`, verificador `node backend/scripts/check-backend-rules.mjs` sin subir techos; Flyway append-only (V21 nueva); `ui:check` en móvil; copy en tuteo, español de Colombia; no inventar tiempos, tarifas ni políticas fuera de lo definido aquí.
- Bounded contexts: `proveedores` no importa tipos de dominio de `ot`/`tecnicos` (se pasan UUID/valores). La ubicación de destino se resuelve en el caso de uso de `ot` y se entrega a `proveedores` como valor.
- Sin tests nuevos desactivados ni aflojados; los existentes se cambian solo donde cambia el comportamiento (el broadcast deja de ser «todos los activos»).

## Enfoques considerados

- **A. Radio escalonado con ventana propia (elegido).** Reutiliza el patrón de las OT: radio inicial 10 km, +5 km por ventana vencida, máximo 25 km. Más cambio (migración + barrido), pero coherente con las OT y justo por cercanía.
- **B. Radio fijo, una sola difusión.** Más simple; si no hay nadie cerca el técnico espera toda la vigencia sin ampliar búsqueda. Descartado.

## Diseño (decidido con el usuario)

- **Destino de la entrega:** `OT.ubicacion` (donde está el técnico trabajando). La distancia proveedor→destino es línea recta.
- **Difusión por radio:** `RequerimientoInsumo` guarda `radioKm` y `ventanaExpiraEn`. La difusión inicial usa 10 km; el barrido de escalado (análogo a `EscalarRadioUseCase`) expira las ofertas pendientes de la ventana, sube el radio y ofrece solo a los nuevos elegibles dentro del radio; en 25 km sin aceptación → `SIN_PROVEEDOR`. Un proveedor ya ofertado no recibe una segunda oferta.
- **Aceptación con ETA:** la aceptación recibe `etaMinutos`. El backend calcula una sugerencia (distancia ÷ velocidad promedio) y la expone en la oferta para que la UI la precargue; el valor aceptado debe estar entre 1 y un tope. Se persiste en la solicitud (`etaMinutos`, `aceptadaEn`) junto con la distancia en km.
- **Despacho:** nuevo estado `DESPACHADO` y caso de uso «despachar» (solo el proveedor ganador, desde `ASIGNADO`). `ENTREGADO` pasa a exigir `DESPACHADO`. Se registra `despachadaEn`.
- **Notificaciones:** `NotificacionInsumoPort` gana adaptador FCM (patrón de `FcmNotificacionPushAdapter`) para: oferta nueva al proveedor; aceptada con ETA, despachada y entregada al técnico. Siempre best-effort, tras el commit.
- **Técnico:** ve en `ejecucion-ot` el estado y el ETA de cada solicitud (la lista `GET /api/ot/{id}/insumos` ya existe y se amplía con ETA/estado).
- **Proveedor (móvil):** `solicitudes-proveedor` muestra distancia a la entrega, pide/confirma ETA al aceptar y ofrece «Despachar» y «Confirmar entrega».

## Decisiones del usuario tras la revisión

- **Ubicación del proveedor:** se captura en la app (endpoint de perfil + pantalla móvil donde el proveedor fija su ubicación, patrón del selector de ubicación existente). Sin ubicación no es elegible ni recibe solicitudes. V21 no hace backfill; los proveedores existentes la fijan al entrar.
- **ETA sin sanción por ahora:** no hay estado de vencido ni re-difusión. Si el ETA se cumple sin despachar, solo se avisa al técnico por push. La re-difusión queda como trabajo posterior.
- Entra en alcance: guardar/leer la ubicación del proveedor (`GestionarMiPerfilProveedorUseCase` y su endpoint) y la pantalla móvil correspondiente.

## Decisiones tomadas por Claude (a revisar)

- Velocidad promedio y tope del ETA (valores concretos) y ventana por radio de insumos: se fijan como propiedades `app.insumos.*` con valores por defecto razonables; **no** se presentan como política de producto.
- La ventana por radio será más larga que los 60 s de las OT; la vigencia total sigue acotada por `app.insumos.vigencia-ms`.
- Ventanas: cuatro radios dentro de la vigencia total, cada ventana = vigencia ÷ 4 (≈ 3 min con los 15 min actuales). El reintento tras `SIN_PROVEEDOR` crea una solicitud nueva (como hoy) que arranca en 10 km con vigencia fresca. `ProgramadorExpiracionInsumo` se fusiona con el nuevo barrido (un solo camino).
- Filas previas a V21: las columnas nuevas son nulables; una solicitud abierta sin `radioKm` no escala y simplemente vence como hoy. `ENTREGADO` sin `DESPACHADO` sigue siendo válido.
- Destino: `OT.ubicacion`; si falta, se usa la última ubicación del técnico; si tampoco hay, 422 sin crear la solicitud.
- Elegibilidad: activo + documentación validada + dentro del radio. `categoriasInsumo` sigue siendo metadato descriptivo, no filtra (así lo declara `Proveedor`).
- Push: se identifica al proveedor por `usuarioId` con `DispositivoPush` (V19); las rutas `/proveedor/...` ya están permitidas en `push.ts`. Si la app del proveedor aún no registra su token, es una tarea móvil pequeña dentro del alcance.
- SSE para el proveedor (como el stream de ofertas del técnico) se deja fuera de la primera entrega: push + recarga de la pantalla.

## A cargo del constructor

Nombres exactos de columnas y endpoints, consultas PostGIS para proveedores en radio, forma del barrido, valores por defecto, specs/tests, copy de las pantallas dentro de las reglas del repo.
