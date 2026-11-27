# Rediseño de los paneles de cliente y técnico (móvil) — 2026-11-27

Segundo paso de P3.1, después de Seguimiento (`2026-11-26-rediseno-seguimiento-design.md`).

## Para qué

El dueño ve la app «insípida» y confirmó que el rediseño de Seguimiento va bien. En los paneles se debe leer primero **qué está pasando** y tener **una sola acción destacada**.

## Metas, no metas, antimetas

- **Metas:** la orden activa domina cada panel; los dos paneles se ven iguales en esa tarjeta.
- **No metas:** otras pantallas, la web, backend, datos nuevos, colores, fuentes o radios nuevos.
- **Antimetas:** mostrar ETA, montos, métricas o fotos que la app no tiene; esconder un aviso que bloquea el trabajo; cambiar el comportamiento de Seguimiento.

## Enfoques considerados

| Enfoque | A favor | En contra |
|---|---|---|
| **A. Tarjeta de orden activa compartida** (elegido por el dueño) | Coherencia; una sola regla de «qué toca hacer» | Hay que sacar esa regla de Seguimiento sin cambiarla |
| B. Cada panel con su tarjeta | Rápido, no toca Seguimiento | Lógica repetida que se desalinea |
| Copiar los prototipos a4 y b0 | Fiel al diseño original | Piden datos que no existen |

## Tarjeta de orden activa (compartida, en `shared/ui`)

De arriba abajo: estado en grande (`aria-live="polite"`), categoría y código, una línea de contexto (técnico para el cliente; cliente y barrio para el técnico), dirección, y **un** botón relleno. Lo que no venga del backend se omite. La tarjeta solo pinta lo que recibe; cada panel decide textos y destino.

La regla «qué toca hacer» se extrae de Seguimiento a una función que usan Seguimiento y el panel del cliente. Las pruebas actuales de Seguimiento siguen pasando sin cambios.

## Panel del cliente

Orden: saludo → tarjeta activa → «Otras órdenes» (activas, compactas) → «Historial» plegado (finalizadas, canceladas y sin técnicos disponibles, con su chip) → pie «Pedir un técnico».

- **Cuál es la grande:** la primera que espera una acción del cliente (pagar la visita antes que revisar presupuesto); si ninguna, la más reciente.
- **Estado en grande:** «Buscando técnico», «El técnico llegó» (con `llegadaEn`, en asignada o en camino) o la etiqueta del estado.
- **Botón:** «Pagar la visita» (lleva a Seguimiento), «Revisar presupuesto» (lleva al diagnóstico) o «Ver seguimiento».
- **Pie:** con tarjeta activa, «Pedir un técnico» va sin relleno; sin ella, relleno.
- **Se quita:** la frase promocional, el botón «Historial», la línea de contadores, los filtros y su subtítulo (incluida la vista «Sin técnico»).
- **Se conserva:** carga, error con reintento, sin perfil de cliente, deslizar para actualizar y el refresco cada 25 s. Sin ninguna orden, el estado vacío invita a pedir.

## Panel del técnico

Con orden activa: avisos que bloquean → tarjeta activa («Abrir ejecución») → «Tu estado» → ofertas → otras órdenes.
Sin orden activa: avisos → «Tu estado» → ofertas → estado vacío.

- **Avisos que bloquean, siempre arriba:** validación rechazada o pendiente, liquidación pendiente, error de ubicación, y «Apagada: no recibes ofertas» cuando hay una orden activa y la ubicación está apagada.
- La orden activa sigue siendo la primera que entrega el backend.
- Disponibilidad, ubicación, ofertas y sus contadores no cambian de comportamiento.
- Se agrega deslizar para actualizar (lo pide la plantilla Cola, `DESIGN.md` §5.1).

## Reglas y pruebas

- `DESIGN.md`: se anota en §0.1 que para estos dos paneles la estructura es este documento (no a4 ni b0), y en §5 la tarjeta nueva. `NAVEGACION.md` §3 se actualiza.
- `npm run ui:check` sin subir techos; targets de 44 px; máximo dos niveles de contenedor; tuteo.
- Pruebas primero: cuál orden es la grande y su botón; reparto entre «Otras» e «Historial»; relleno del pie; orden del panel del técnico con y sin orden activa; avisos visibles. Se reescriben las pruebas de los filtros, contadores y botón «Historial» porque esos elementos desaparecen.
- `mobile:test` y `mobile:build` en verde; APK para que el dueño lo vea en el teléfono.

## Decisiones tomadas por quien redacta (revisar)

1. Una orden **finalizada** va al historial y no ocupa la tarjeta grande, aunque Seguimiento ofrezca «Ver acta».
2. Una orden **en disputa** muestra «Ver seguimiento», sin invitar a pagar desde el panel.
3. Los filtros y contadores se reemplazan por «Otras órdenes» e «Historial».

## Queda a criterio de quien lo construya

Nombres, ubicación exacta de la función compartida, clases CSS y reparto de tareas.
