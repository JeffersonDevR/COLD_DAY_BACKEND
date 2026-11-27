# Cobro, comisión y consignación del técnico — 2026-11-27

## Reglas del dueño

- La comisión para COLD DAY es del **15 %**.
- El cobro al cliente es **presupuesto más visita**.
- Un técnico **no puede recibir órdenes sin haber consignado**.

El valor registrado al cerrar es presupuesto + tarifa de visita, y el 15 % se calcula sobre ese total (confirmado).

## Estado actual (leído en el código, sin reproducir)

- El 15 % ya es el valor por defecto (`app.liquidacion.comision-porcentaje:0.15`).
- La liquidación y el bloqueo solo ocurren si alguien llama `POST /api/liquidaciones/ot/{otId}`; **ninguna pantalla lo llama**. Al finalizar, el técnico queda `DISPONIBLE`.
- **El bloqueo se puede saltar:** `Tecnico.cambiarEstado` permite `BLOQUEADO_POR_LIQUIDACION → FUERA_DE_SERVICIO`, y desde ahí `→ DISPONIBLE`.
- Ninguna pantalla envía el comprobante (`POST /api/liquidaciones/{id}/comprobante`).

## Enfoques

| Enfoque | A favor | En contra |
|---|---|---|
| **A. El servidor crea la liquidación y bloquea al finalizar** (recomendado) | No se puede omitir; el valor lo calcula el servidor | Cambia backend y el contrato de finalizar |
| B. La app registra el cobro después de finalizar | Solo toca la app | Si falla o se omite, no hay bloqueo; el valor lo manda el teléfono |

## Diseño (con A)

- Finalizar recibe el medio de pago; calcula presupuesto + visita, crea la liquidación y bloquea al técnico en la misma operación.
- Un técnico con liquidaciones sin aprobar no puede pasar a `DISPONIBLE` ni aceptar ofertas, venga del estado que venga.
- La app muestra antes de cerrar: valor a cobrar, comisión (15 %) y que quedará bloqueado hasta consignar.
- **Gestión:** cada liquidación pendiente o rechazada permite enviar el **número de referencia** de la consignación. La foto se agrega cuando exista el bucket.
- La consola de administración muestra la referencia como texto (hoy espera un enlace).
- Aprobar el comprobante desbloquea, como hoy; con más de una pendiente, solo al aprobar la última.

## Orden de entrega

El bloqueo y el envío de la referencia **salen juntos**: bloquear sin poder enviar el comprobante dejaría a los técnicos sin salida.

## Decisiones del dueño (2026-11-27, respuestas)

- Las órdenes ya finalizadas sin cobro son de desarrollo: **no se migran**. El caso se revisa con un ejemplo en las pruebas.
- Presupuesto rechazado: **no hay comisión**; la visita es solo diagnóstico y traslado.
- La visita que paga el cliente desde la app **la retiene COLD DAY** hasta que el servicio termine, para no devolver transacciones si cambia el técnico por un motivo externo.

## Decisión vigente (dueño, 2026-11-27): mientras no haya pasarela, todo se paga al técnico

- La visita se paga **al técnico**; COLD DAY **no retiene** nada todavía.
- Al cerrar: total = visita + trabajo. El técnico consigna el **15 % del total** y queda bloqueado hasta que se apruebe.
- Ejemplo: 30.000 + 200.000 = 230.000; consigna **34.500**.
- Presupuesto rechazado: sin comisión, sin liquidación y sin bloqueo.
- Criterio de quien redacta (revisar): efectivo y transferencia se tratan igual, porque en ambos el dinero lo recibe el técnico.
- La retención de la visita queda para cuando exista la pasarela.

**El requisito previo se deja como está** (dueño): el técnico no se desplaza hasta que el cliente marque la visita como pagada, aunque con efectivo el dinero se entregue en persona. No se cambian textos ni reglas de ese paso.

## A futuro (no se diseña aún)

Banco de repuestos por proveedor.
