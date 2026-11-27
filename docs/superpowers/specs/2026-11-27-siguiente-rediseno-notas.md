# Siguiente rediseño móvil — notas (borrador, sin aprobar) — 2026-11-27

Lo que pidió el dueño tras probar el APK con los paneles nuevos («todo bien»), más lo hallado en el código. Todavía no es una especificación.

## Pedidos del dueño

1. **Deslizar para recargar en todas las pantallas**, no solo en las órdenes del técnico.
2. **Espaciado:** la tarjeta de la orden y el historial quedan muy pegados al saludo «Hola, <nombre>».
3. **Pestaña «Mis equipos»:** debe llamarse de otra forma, porque es el historial de órdenes de trabajo.
   - Las tarjetas están mal organizadas.
   - No se entiende el «Media» junto a «Finalizada».
   - Sobra el conteo de servicios por categoría.
   - «Ver la última OT» suena a la última orden en general; usar «Revisar» o similar.
4. **Quitar el historial del inicio:** repite lo que hace esa pestaña.
5. **Error:** tras pagar en efectivo como cliente, el técnico no puede consignar.

## Hallazgos en el código

### Consignación: no existe en ninguna interfaz
- `LiquidacionApi.registrarPago` (`POST /api/liquidaciones/ot/{otId}`, el técnico registra lo cobrado) **no se llama desde ninguna pantalla**. El caso de uso solo lo invoca ese endpoint.
- `LiquidacionApi.subirComprobante` (`POST /api/liquidaciones/{id}/comprobante`) tampoco tiene pantalla de técnico.
- La app dice «Regístrala en la web», pero la web hoy solo tiene páginas de administración (y `usa-la-app`).
- El comprobante es un texto (`comprobanteUrl`, máx. 1000); el backend no guarda archivos. El admin lo muestra como enlace «Ver Recibo Bancario».
- Sin reproducir contra datos reales: falta confirmar qué ve el técnico tras el pago en efectivo.

### Pestaña de equipos
- Agrupa por categoría y solo abre la **última** orden de cada una. Si se quita el historial del inicio sin cambiar esta pestaña, las órdenes anteriores quedan inalcanzables. La pestaña tiene que listar **todas** las órdenes.

### Regla en conflicto
- `DESIGN.md` §5 exige el chip de prioridad en toda tarjeta de orden del cliente. Quitarlo de las cerradas obliga a cambiar esa regla.

## Propuestas de quien redacta (por confirmar)

- Pestaña «Historial»: una tarjeta por orden (categoría, código, fecha, estado, dirección), botón «Revisar», sin conteo por categoría.
- Prioridad: fuera en órdenes cerradas; en las activas, «Prioridad media» con la palabra.
- Inicio del cliente: sin historial; si no hay órdenes en curso, un vacío que lo diga.
- Recargar: en todas las listas y detalles con datos remotos; no en formularios ni en el asistente de solicitud.
- La consignación va primero y aparte: bloquea el cobro de la comisión.

## Pendiente de decidir

- Cómo prueba el técnico la consignación (referencia escrita, o foto del recibo, que requiere almacenamiento en el backend).

## A futuro (pedido del dueño 2026-11-27, no ahora)

- Evaluar un banco de repuestos por proveedor.
