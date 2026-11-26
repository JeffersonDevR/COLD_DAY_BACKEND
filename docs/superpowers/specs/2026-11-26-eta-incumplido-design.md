# ETA incumplido en repuestos: decide el técnico — 2026-11-26

Ítem P2.1 de `docs/superpowers/plans/2026-11-25-backlog-movil-priorizado.md`.

## Para qué

Hoy, si el proveedor que ganó un pedido no lo despacha dentro del tiempo que prometió, solo se avisa al técnico por push (`AvisarEtaVencidoUseCase`) y el pedido sigue en sus manos para siempre. El técnico queda esperando sin salida.

## Decisiones del dueño

- **Quien decide qué pasa con el pedido es el técnico.** No hay redifusión automática.
- **El incumplimiento solo queda registrado** y el admin lo puede ver. Sin sanción, bloqueo ni contador que afecte al proveedor.

## Decisiones propuestas por mí (aceptadas con el resto salvo que las corrijas)

- Sin gracia adicional: las opciones aparecen apenas vence el ETA sin despacho.
- Un pedido ya despachado no se puede quitar, aunque llegue tarde.
- Cuenta como incumplimiento **solo** cuando el técnico cambia de proveedor. Si espera y el proveedor despacha tarde, no se registra nada.

## Fuera de alcance

Sanciones, reputación visible para clientes, ETA después del despacho, cobros, y avisar al técnico con otra cadencia.

## Enfoques considerados

| Enfoque | A favor | En contra |
|---|---|---|
| **A. Reabrir el mismo pedido** (elegido) | El técnico ve un solo pedido; reutiliza difusión por radio, escalado y vencimiento | Hay que limpiar los datos de la asignación anterior |
| B. Cerrar el pedido y crear otro igual | Historial más limpio | El técnico ve dos pedidos; hace falta un estado nuevo del pedido y copiar los ítems |

Elegí A como llamada técnica mía.

## Comportamiento

### Técnico (móvil, "Insumos solicitados" en la ejecución de la OT)

En un pedido `ASIGNADO` con `aceptadaEn + etaMinutos <= ahora`:

```
El proveedor no ha despachado
Prometió 30 min · van 38
[ Seguir esperando ]   [ Buscar otro proveedor ]
```

- **Seguir esperando:** solo pliega el aviso en esa pantalla, dejando "Buscar otro proveedor" a la mano. No llama al servidor.
- **Buscar otro proveedor:** pide confirmación ("Si nadie más acepta, el pedido queda sin proveedor") y llama al servidor.
- La lista de pedidos se refresca sola (hoy solo se carga al entrar) y el aviso aparece sin salir de la pantalla.
- Si el servidor responde 409, se muestra "El proveedor ya despachó el pedido" o "Todavía no vence el tiempo prometido" y se recarga la lista.

### Servidor

`POST /api/insumos/{id}/cambiar-proveedor`, rol `TECNICO`, **solo el técnico dueño del pedido** (otro técnico: 404). En una sola transacción:

1. `UPDATE` condicional del pedido: solo si sigue `ASIGNADO` y el ETA ya venció. Si no cambia ninguna fila, 409.
2. El pedido vuelve a `SOLICITADO` con vigencia nueva completa, radio inicial y ventana nueva; se borran `etaMinutos`, `distanciaKm`, `aceptadaEn` y `etaAvisoEn`.
3. La oferta ganadora pasa de `ACEPTADA` a `REEMPLAZADA` (estado nuevo). Sin esto el proveedor anterior la vería revivir y podría despachar un pedido que ya no es suyo.
4. Se guarda el incumplimiento: pedido, proveedor, ETA prometido, cuándo aceptó y cuándo se le reemplazó.
5. Se ofrece de nuevo a los proveedores elegibles del radio, y se avisa por push (best effort) al proveedor reemplazado.

Quién recibe la nueva oferta: se excluye a quien incumplió ese pedido y a quien lo rechazó. **Sí** se vuelve a ofrecer a quienes tenían la oferta `CANCELADA` porque otro ganó. Hoy `proveedoresOfertados` excluye cualquier oferta previa, así que hay que ajustarlo. La exclusión vale solo para ese pedido.

Si nadie acepta dentro de la vigencia, queda `SIN_PROVEEDOR`, como hoy.

### Carrera "despachar" contra "cambiar"

Gana el primero que llegue. `DespacharInsumoUseCase` hoy guarda la copia que leyó; debe pasar a un `UPDATE` condicional (`WHERE estado = 'ASIGNADO'`) y comprobar que la oferta siga `ACEPTADA` dentro de la misma transacción. El que pierde recibe 409; el proveedor ve "Este pedido ya no es tuyo".

### Proveedor (móvil y web)

La oferta `REEMPLAZADA` no aparece en su bandeja. No necesita pantalla nueva.

### Admin (web)

En "Proveedores Auxiliares", una sección **Incumplimientos de ETA**: por fila, proveedor, minutos prometidos, fecha de aceptación y fecha del reemplazo, más recientes primero; y el total por proveedor. `GET /api/proveedores/incumplimientos`, rol `ADMINISTRADOR`. Solo lectura. Estado vacío: "No hay incumplimientos registrados".

## Datos

Migración nueva `V22` (la fase B de documentos pasa a `V23`):

- agrega `REEMPLAZADA` al check de `oferta_insumo.estado`;
- crea `incumplimiento_insumo` (`id`, `requerimiento_id`, `proveedor_id`, `eta_minutos`, `aceptada_en`, `reemplazado_en`), con claves foráneas e índice por proveedor.

## Pruebas que deben existir

- Antes de vencer el ETA: 409 y nada cambia.
- Vencido: pedido reabierto, oferta `REEMPLAZADA`, incumplimiento guardado, nuevas ofertas sin el que incumplió ni quien rechazó, y con los antes `CANCELADA`.
- Despachado: 409. Otro técnico: 404.
- Carrera despachar contra cambiar: exactamente uno gana.
- El proveedor reemplazado no puede despachar ni ver el pedido, ni siquiera después de que otro lo acepte.
- Móvil: el aviso aparece solo con ETA vencido y sin despacho; "Seguir esperando" no llama a la API.
- Web: la sección de incumplimientos con filas y vacía.

## Queda a criterio de quien lo construya

Nombres internos, componente del aviso, y cadencia del refresco (reutilizar el sondeo de respaldo que ya existe en la pantalla).

## Riesgo a saber

El técnico puede cambiar de proveedor aunque el primero ya vaya en camino sin haber tocado "Despachar". El proveedor recibe el aviso del reemplazo, pero el viaje ya está hecho. Es consecuencia de no tener GPS del proveedor.
