# Observaciones tras los paneles: historial, espaciado y recarga (móvil) — 2026-11-27

Sale de `2026-11-27-siguiente-rediseno-notas.md`: lo que el dueño vio al probar el APK.

## Metas y no metas

- **Metas:** que el historial viva en un solo sitio y se entienda; que el contenido respire bajo el saludo; que deslizar recargue en toda pantalla con datos del servidor.
- **No metas:** consignación, subida de archivos y bucket (van después, mientras el dueño revisa el bucket); otras pantallas del rediseño; web y backend.

## Enfoques para el historial

| Enfoque | A favor | En contra |
|---|---|---|
| **A. La pestaña lista todas las órdenes** (elegido) | Todo se alcanza en un solo sitio | Se pierde la agrupación por equipo |
| B. Seguir por categoría, desplegando sus órdenes | Conserva «equipos» | Más toques y la misma confusión de nombre |
| C. Dejar el historial en el inicio | No hay que tocar la pestaña | El dueño lo ve inservible |

## 1. Pestaña «Historial» (antes «Mis equipos»)

- Cambian el nombre de la pestaña, la barra de marca y el título de la ruta; la dirección `/cliente/equipos` no cambia.
- Una tarjeta por orden, de la más reciente a la más antigua: categoría, código, chip de estado, fecha, dirección o barrio, la falla (máximo dos líneas) y el botón **«Revisar»**, sin relleno, que abre su Seguimiento.
- Se quita el conteo por categoría, «Ver la última OT» y la línea «N equipos · historial completo».
- Prioridad: las órdenes cerradas no la muestran; las activas dicen «Prioridad alta/media/baja».
- El pie pasa de «Registrar otro equipo» a «Pedir un técnico».
- Carga, error con reintento, sin perfil de cliente y vacío («Aún no tienes servicios») se conservan, sin la palabra «equipos».

## 2. Inicio del cliente

- Se quita el historial plegado. Quedan tarjeta activa, «Otras órdenes» y el pie.
- Sin órdenes en curso: «No tienes servicios en curso», con «Los anteriores están en Historial.» si los hay.
- La prioridad en la tarjeta grande y en las compactas usa el mismo texto con la palabra «Prioridad».

## 3. Espaciado

El bloque del saludo no tiene margen inferior. Se le da `1rem` en todas las pantallas que lo usan.

## 4. Deslizar para recargar

- Se agrega a: Historial, Cuenta, ofertas del técnico, solicitudes y documentos del proveedor, Seguimiento, ejecución, diagnóstico, pago y acta, y perfil técnico.
- Ya lo tienen: los dos paneles y Gestión. No va en login, registro, solicitar servicio ni calificar.
- Una sola pieza compartida con los mismos textos.
- El indicador siempre se cierra; si falla, se conserva lo que se ve y se avisa «No pudimos actualizar».
- Donde hay un formulario (ejecución, diagnóstico, pago, perfil), recargar **no borra lo que se está escribiendo**.

## Reglas y pruebas

- `DESIGN.md`: la regla de prioridad (§5) pasa a «solo en órdenes activas y con la palabra Prioridad»; se anota que esta pantalla ya no sigue el prototipo a10; §5.1 pide deslizar también en detalles. `NAVEGACION.md` se actualiza.
- Pruebas primero; `ui:check` sin subir techos; `mobile:test`, `mobile:build` y APK.

## Decisiones de quien redacta (revisar)

1. La dirección interna de la pestaña no cambia.
2. «Prioridad» con la palabra, en vez de quitarla de las activas.
3. El pie del historial dice «Pedir un técnico».

## Lo que queda aparte

Consignación del técnico: ninguna pantalla permite registrar el cobro ni enviar el comprobante. Es el siguiente trabajo, y la foto depende del bucket.
