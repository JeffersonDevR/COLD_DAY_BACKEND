# Flujo de solicitud de servicio — Dark Ops (Ionic)

Referencia visual y de implementación del flujo transaccional de solicitud, con las reglas de UI/UX acordadas (2026-10-30). Son prototipos estáticos en HTML — la versión de producción se implementa con componentes Ionic.

## Pantallas

| Archivo | Paso | CTA |
|---|---|---|
| `a5-1-ubicacion.html` | Paso 1 de 3 — ubicación | `Continuar` |
| `a5-2-detalle.html` | Paso 2 de 3 — especialidad + descripción | `Continuar a revisión` |
| `a5-3-confirmacion.html` | Paso 3 de 3 — revisión | `Solicitar técnico` |
| `estados-cta.html` | Especificación | habilitado / deshabilitado / cargando |

## Tokens

| Token | Valor |
|---|---|
| Canvas | `#0b1220` |
| Surface | `#111b2e` |
| Surface elevada | `#16223b` |
| Borde | `#1e293b` |
| Borde claro | `#334155` |
| Primario (acento) | `#22d3ee` |
| Primario hover | `#06b6d4` |
| Aviso / pagos | `#f59e0b` |
| Repuestos | `#a78bfa` |
| Éxito | `#22c55e` |
| Error | `#f87171` |
| Texto principal | `#f8fafc` |
| Texto de cuerpo | `#e2e8f0` |
| Texto de etiqueta | `#cbd5e1` |
| Texto secundario | `#94a3b8` |
| Títulos | Space Grotesk |
| Cuerpo / labels | Inter |

`#64748b` está prohibido sobre estos fondos: no alcanza 4.5:1.

## Reglas aplicadas

1. **Categorías**: tarjeta vertical (icono arriba, nombre y subtipo debajo), sin truncamiento, indicador de selección 24×24 en la esquina superior derecha, estado activo con borde 1.5px + ring + tinte tenue, toda la tarjeta es el target táctil.
2. **Descripción**: etiqueta `2. Describe la falla o ruido extraño *` en 14px semibold, acción `Dictar por voz` con micrófono (44×48 mínimo). Sin texto estático tipo "Voseo asistido".
3. **Ubicación**: una sola tarjeta clickeable (≥64px) con icono, título, subtítulo completo y chevron; coordenadas en modo lectura con candado.
4. **Evidencia fotográfica**: sección eliminada. No existe estado disabled ni badge "Próximamente".
5. **Contraste y tipografía**: secundarios `#94a3b8`, etiquetas `#cbd5e1`, microcopy mínimo 12px con peso 500-600.
6. **CTA**: `Continuar` (paso 1) → `Continuar a revisión` (paso 2) → `Solicitar técnico` (paso 3). Altura 52px, helper 12px arriba del botón, estados explícitos.
7. **Ergonomía**: CTA fijo en la zona inferior, targets ≥48dp, hint de gesto `Desliza para volver`.

## Implementación en Ionic

- Layout: `ion-header` + `ion-content` (scroll) + `ion-footer` fijo para el CTA; `--background` y `--color` sobre tokens.
- Selección de especialidad: `ion-radio-group` con `ion-radio` oculto y tarjeta clickeable como `label` (mantiene accesibilidad y área táctil completa).
- Descripción: `ion-textarea` con `autoGrow`, contador y botón de dictado; en producción usar Web Speech API con fallback a teclado.
- Ubicación: `ion-item button` completa (no un `div` con `(click)`), coordenadas en `ion-text` con `readonly`.
- CTA: `ion-button` con `expand="block"`, `[disabled]` y estado de carga con `ion-spinner` + `aria-busy="true"`.
- Gesto de retroceso: `IonRouterOutlet` con `swipeGesture` habilitado; la animación nativa ya respeta el gesto del sistema.
- Estados: `disabled` = `opacity: .4` + `cursor: not-allowed`; `loading` = spinner 20px + texto `Procesando…` + bloqueo de doble envío.

## Limitaciones de estos prototipos

- El mapa es un SVG decorativo: no hay integración real de mapas ni geocodificación.
- La búsqueda de direcciones muestra resultados mock.
- Los textos de ejemplo (dirección, descripción, montos) son datos de muestra.
