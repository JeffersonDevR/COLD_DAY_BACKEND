# Mapas con proveedor intercambiable (frontend) — diseño

Fecha: 2026-11-25 · Estado: **pendiente de aprobación**

## Intención

Poder cambiar de Google Maps a Mapbox (o a otro) tocando un solo lugar, sin reescribir cada pantalla. Hoy
cada componente de mapa habla directo con `google.maps.*`. La migración a Mapbox se está evaluando; este
trabajo no migra: deja el frontend listo para que migrar sea escribir un motor nuevo.

## Estado actual (medido)

- Cargador único: `core/service/google-maps-loader.ts` (230 líneas) + `@angular/google-maps`.
- Cuatro componentes con objetos de Google: `shared/mapa-radar`, `shared/mapa-seguimiento`,
  `shared/selector-ubicacion-mapa` (web) y `projects/mobile/.../seguimiento-ot/mapa-seguimiento.component.ts`
  (móvil, 344 líneas, con su propia copia de la lógica).
- Geocodificación/autocompletado del lado del cliente: `core/service/maps-geocoder-cliente.ts`
  (fallback del proxy `/api/maps/*`).
- Estilo oscuro en formato Google: `core/service/mapa-estilos.ts`. Ruta en polyline de Google:
  `core/service/polyline-ruta.ts`.
- Backend: `GoogleMapsAdapter` detrás del puerto `MapsPort` (geocodificar, inversa, autocompletar, matriz,
  direcciones). **Ya es intercambiable**; no se toca aquí.
- Config del mapa (centro, límites, zoom, radios) ya viene del backend (`GET /api/config/maps`).

## Metas

- Un contrato de "motor de mapa" propio, sin tipos de Google en las pantallas.
- Un solo componente de mapa declarativo que usan las 4 vistas (se elimina la copia móvil).
- Elegir el motor por configuración (`proveedor` en `/api/config/maps`), sin recompilar.
- Cero cambios visibles: mismo mapa, mismos marcadores, misma ruta.

## No metas

- No implementar Mapbox ni tocar el backend en este trabajo.
- No quitar Google: queda como el primer motor.
- No cambiar el contrato de ruta (el backend sigue devolviendo polyline codificado; Mapbox Directions lo
  puede emitir en el mismo formato, así el decodificador se conserva).

## Alternativas consideradas

1. **Motor detrás de una interfaz + un componente declarativo (recomendada).** Las vistas pasan datos
   (centro, zoom, marcadores, líneas, círculos, límites); el motor los dibuja. Mapbox = un archivo nuevo.
   Costo: reescribir los 4 componentes una vez y mantener la paridad con Google.
2. **Envoltorios finos por componente.** Cada componente mantiene su lógica y solo cambia las llamadas a
   `google.maps` por un helper. Menos trabajo ahora, pero la lógica sigue duplicada y cada motor nuevo
   exige tocar 4 sitios.
3. **Librería neutral (MapLibre) para todo.** Elimina Google en el cliente, pero ata a otro motor y no
   resuelve "poder cambiar"; descartada.

## Diseño (alternativa 1)

```
core/maps/
  mapa-motor.ts            interfaz MapaMotor + MapaInstancia + tipos (Coordenada, MarcadorSpec, LineaSpec,
                           CirculoSpec, LimitesSpec, EstiloMarcador)
  mapa-motor.token.ts      InjectionToken MAPA_MOTOR (fábrica según config.proveedor, carga perezosa)
  google/google-motor.ts   implementación actual con google.maps (reutiliza el cargador)
  geocodificador.ts        interfaz GeocodificadorCliente + token; google/google-geocodificador.ts
shared/mapa/mapa.ts        <app-mapa> declarativo: inputs centro, zoom, limites, marcadores, lineas,
                           circulos, alto; outputs mapaClick, marcadorArrastrado
```

- `MapaInstancia`: `actualizar(spec)` (diff por id), `ajustarA(limites)`, `destruir()`. Sin tipos del
  proveedor en la firma.
- Marcadores y líneas se describen por `id` y estilo semántico (`tecnico`, `cliente`, `proveedor`,
  `ruta`), no por `Symbol`/`Icon` de Google. Cada motor traduce el estilo.
- `MAPA_ESTILOS` y el formato de color pasan a ser detalle del motor Google.
- Si el motor no carga (sin key, sin red), `<app-mapa>` muestra el mismo respaldo que hoy: el texto con
  distancia y ETA nunca vive solo dentro del mapa.
- Config: `/api/config/maps` suma `proveedor` (`google` por defecto) y `token`; `apiKey` se mantiene como
  alias mientras exista Google.

## Pasos

1. Interfaces + motor Google + `<app-mapa>`, con specs.
2. Migrar `mapa-seguimiento` web y `selector-ubicacion-mapa`.
3. Migrar `mapa-radar` (círculos) y el mapa de seguimiento móvil, borrando su copia.
4. Geocodificador cliente detrás de su interfaz.
5. Quitar `@angular/google-maps` de las pantallas (queda solo en el motor Google).

Cada paso es un commit y deja la suite verde. Verificación: `npm run ui:check`, specs web y móvil.

**Alcance real (2026-11-25):** core y móvil. La web (`mapa-radar`, `mapa-seguimiento`, `selector-ubicacion-mapa`)
sigue con `@angular/google-maps` por decisión del usuario (la web solo importa para admin, que no usa mapas);
migrarla es un trabajo aparte. Los pasos 2, 3 y 5 de arriba se cumplieron solo para el mapa móvil; el 4 (geocodificador) y el
contrato quedaron completos.

## Lo que queda para quien implemente

- Forma exacta de `MarcadorSpec`/`LineaSpec`, y cómo se diferencia (diff) la actualización.
- Si `proveedor` falta o es desconocido: caer a `google`.
- Paridad visual: comparar capturas antes/después en web y en un dispositivo.

## Para evaluar Mapbox después (fuera de este trabajo)

- Calidad de geocodificación y autocompletado con direcciones reales de Cúcuta, frente a Google.
- Costos y límites vigentes de Mapbox para el volumen esperado (verificar en su página, no asumir).
- Mapbox GL necesita WebGL: probar en el WebView de Android objetivo.
- Backend: un `MapboxMapsAdapter` que implemente `MapsPort`, elegido por `app.maps.provider`.
