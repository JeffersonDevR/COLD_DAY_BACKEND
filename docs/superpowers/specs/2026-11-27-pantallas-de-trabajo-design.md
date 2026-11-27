# Rediseño de las pantallas de trabajo: ejecución, diagnóstico y pago (móvil) — 2026-11-27

Se implementa después de `2026-11-27-observaciones-historial-recarga-design.md`, que el dueño pidió ampliar con este grupo.

## Para qué

La misma receta de Seguimiento y los paneles: se lee primero lo que importa y hay **una sola acción**, en el pie fijo (`DESIGN.md` §4).

## Metas y no metas

- **Metas:** jerarquía y acción principal en las tres pantallas; que el cierre muestre qué se cobra.
- **No metas:** cobro y consignación (van en su propia especificación), backend, web, cambios en las reglas de negocio.

## Enfoques

| Enfoque | A favor | En contra |
|---|---|---|
| **A. Reordenar cada pantalla con las piezas que ya existen** (elegido) | Rápido y coherente | Las pantallas siguen siendo distintas entre sí |
| B. Una plantilla de detalle compartida | Más uniforme | Mueve mucho código a la vez y arriesga el comportamiento |

## Ejecución (técnico)

- Arriba: paso actual en grande, con dirección; si la visita está sin pagar, se dice ahí.
- Acción en el pie según el paso: «Iniciar desplazamiento», «Llegué al domicilio», «Enviar diagnóstico», «Finalizar y cobrar».
- El formulario de diagnóstico y los insumos quedan como contenido; el aviso de proveedor atrasado conserva sus botones, sin relleno.
- **Cierre:** muestra el valor a cobrar y el medio (efectivo o transferencia).

El cobro, la comisión y el bloqueo se diseñan en `2026-11-27-cobro-comision-consignacion-design.md`.

## Diagnóstico y presupuesto (cliente)

- Primero, en grande, el valor que se autoriza; debajo el desglose y después el dictamen.
- Pie sin cambios: «Aprobar y reparar» (relleno) y «Rechazar».

## Pago y acta (cliente)

- Primero, en grande, lo que falta por pagar; la visita ya pagada se marca como pagada y no se suma a lo pendiente.
- Luego el acta y la firma; el pie no cambia.

## En las tres

- Se corrige el voseo («Dibujá tu firma acá», «Explicá la discrepancia»).
- Se conservan `data-testid`, estados de carga y error, y el comportamiento de formularios, firma y SSE.
- Pruebas primero; `ui:check` sin subir techos; `mobile:test`, `mobile:build`, APK.

## Por confirmar (no se cambia sin tu respuesta)

- El acta muestra «NIT 901.849.201-4» y dice que la garantía está «amparada por la póliza»: confirmar que ambos son reales (`PRODUCT.md`: no inventar políticas).
- Si el total del presupuesto que entrega el servidor ya incluye la visita; se verifica antes de tocar las sumas.
