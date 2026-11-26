# Rediseño de Seguimiento (cliente, móvil) — 2026-11-26

Primer paso de P3.1. Referencia de estructura: el prototipo Stitch `seguimiento_en_vivo_de_orden` que entregó el dueño.

## Para qué

El dueño ve la app «insípida»: en Seguimiento todo pesa lo mismo y la pantalla abre con una fila de botones. Debe verse de un vistazo **qué está pasando y qué tengo que hacer**.

## Decisiones del dueño

- **Se mantiene el tema oscuro** y las reglas de `DESIGN.md`. De Stitch se toma estructura y jerarquía, no color ni tipografía.
- Se empieza por Seguimiento; el resto de pantallas va después, si convence.

## Enfoques considerados

| Enfoque | A favor | En contra |
|---|---|---|
| **Seguimiento primero** (elegido) | Se prueba pronto en el celular | El resto sigue igual mientras tanto |
| Piezas comunes primero | Más uniforme | Tarda en verse algo |
| Solo las dos pantallas de Stitch del cliente | Rápido | El resto seguiría plano |

## Orden de la pantalla

| # | Bloque | Cuándo | Contenido |
|---|---|---|---|
| 0 | Cabecera | siempre | volver, código y chip de estado (como hoy) |
| 1 | Mapa a todo el ancho | técnico en movimiento | sin título propio; distancia o «ya llegó» como chip sobre el mapa |
| 2 | **Dato dominante** | siempre | ver tabla siguiente; si hay mapa, la tarjeta se monta sobre su borde inferior |
| 3 | Técnico | hay técnico | inicial, nombre, teléfono, «Llamar», «Ver diagnóstico» |
| 4 | Progreso | siempre | línea **vertical**, un paso por fila, con la hora del historial cuando exista; el historial completo sigue plegado |
| 5 | Servicio | siempre | línea, dirección, barrio, total cotizado, garantía y la falla reportada, en **una** tarjeta |
| 6 | Política de cancelación y acciones secundarias | según estado | «Abrir disputa», «Calificar servicio», «Cancelar solicitud», sin relleno |

Dato dominante:

| Situación | Se lee grande | Debajo |
|---|---|---|
| Buscando | «Buscando técnico» | el aviso actual |
| En camino con ETA | «14 min» | distancia en km |
| En camino sin ETA | «Técnico en camino» | — |
| Llegó | «El técnico llegó» | hora |
| Otro estado | la etiqueta del estado | fecha de creación |

## Acción principal

Va **una sola, rellena, en el pie fijo** (`cd-footer`), como exige `DESIGN.md` §4. Con esta prioridad: pagar la visita → revisar presupuesto → ver acta y pago. Si ninguna aplica, no hay pie.

El pago de la visita conserva su tarjeta (explicación, tarifa y medio de pago), justo después del dato dominante; el botón «Pagar» pasa al pie.

## Qué se quita

- El espacio de calificación del técnico («Sin rating»): el servidor nunca envía `tecnicoReputacion`.
- «Barrio: Centro» cuando no hay barrio (valor inventado): la fila se omite.

## Fuera de alcance

Chat, placa y vehículo, código de puerta, clima, hora estimada de reloj, foto del técnico, hoja arrastrable, la web, y cualquier cambio de backend. Los modales de cancelar y disputar no cambian.

## Reglas y pruebas

- Sin colores, fuentes ni radios nuevos; `npm run ui:check` sin subir techos; máximo dos niveles de contenedor; áreas táctiles de 44 px; mapa con `clamp()`.
- Se conservan los `data-testid` y el comportamiento actuales (sondeo, SSE, pagos, modales).
- Pruebas: la acción del pie según estado y su prioridad; el dato dominante en cada situación; hora por paso desde el historial; la tarjeta ya no muestra «Sin rating».
- Falta verificar en pantalla real: lo hace el dueño con el APK.

## Cambio de reglas

Se anota en `DESIGN.md` §0.1 que, para Seguimiento, la referencia de estructura pasa a ser este documento.

## Queda a criterio de quien lo construya

Nombres de clases y reparto en componentes.
