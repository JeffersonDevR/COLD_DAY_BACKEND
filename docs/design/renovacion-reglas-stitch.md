# Renovación de reglas vs. Stitch (2026-11-23)

Decisión del dueño del producto: **la fidelidad al diseño Stitch manda**; donde una regla de `DESIGN.md` bloquee su aplicación correcta, la regla se renegocia en vez de saltarse el diseño.

Este documento es la negociación, elemento por elemento, con su costo real. No es una lista de deseos: cada fila dice qué hace falta para pintarlo hoy.

## 1. Ya aplicado (sin necesidad de tocar reglas)

- **Barra de marca universal** (`<cd-marca>`): identidad + etiqueta de pantalla + chip de contexto en las pantallas de tabs (Panel, Mis órdenes, Cuenta, Radar, Panel de técnico, Solicitudes, Documentos). Era el patrón más visible de Stitch y vivía solo en el Panel del cliente. Codificado como componente en `DESIGN.md` §5.
- Iconos de categoría, títulos Grotesk, conteos vivos, etiquetas canónicas, migración a tuteo (B1, C0/C1, A3, A10, B4, A6, C2).

## 2. Bloqueado por DATOS (ninguna regla lo arregla; requiere backend)

| Elemento Stitch | Dónde fallaría | Tarea backend necesaria |
|---|---|---|
| Monto en ofertas de técnico ("$140.000 COP") | `OfertaTecnicoResponse` no trae precio | Campo `montoEstimadoCop` + cálculo en el broadcast |
| "Cotizar + monto" del proveedor | `ProveedoresApi.aceptar(id)` no recibe precio | Flujo de cotización (endpoint + estado COTIZADO) |
| Rating "4.8 (124 servicios)" en Cuenta/Perfil | la pantalla no carga reputación (el campo existe en el técnico) | Exponer reputación en el perfil en sesión, o traerla al cargar |
| Avatar con foto | no hay campo de foto de usuario | Upload de avatar + campo |
| KPIs de C0 (despachadas mes / facturado) | no existen endpoints de métricas de proveedor | Endpoints de métricas por rol |
| "CONTE #4829" junto al nombre | la matrícula es un documento, no un campo del perfil | Campo `matricula` en `TecnicoResponse` |
| ETA estática "12 min" | el móvil ya calcula ETA real con posición viva | nada: lo real > lo estático |
| Precio por línea de insumo + total autocompletado | `InsumoLinea` es `{descripcion, cantidad}`: sin precio por línea, el total de repuestos se escribe a mano | Campo `precio` en la línea (backend + contrato) y que el total de repuestos sea la suma |
| Selección de insumo desde catálogo (marketplace de proveedores) | no hay catálogo: la línea es texto libre | Catálogo de insumos por proveedor + búsqueda en el diagnóstico; el requerimiento al proveedor ya existe (C0/C1) |

**Regla de honestidad vigente:** mientras el backend no traiga el dato, el número NO se pinta (PRODUCT.md "no inventar"). No es una regla de estilo: es no mentirle al usuario.

## 3. Bloqueado por REGLA (renegociable aquí)

| Elemento Stitch | Regla actual | Propuesta |
|---|---|---|
| Grid de 3 KPIs como apertura de pantalla (C0) | §4 "hero-metric: prohibido" | Mantener la prohibición **sin datos reales**; permitir KPIs solo cuando cada cifra venga del backend (condición, no prohibición absoluta) |
| Pulsos/animate-ping en chips de estado | un solo indicador "live" por pantalla | Permitir UN pulso en el chip del modo activo del `<cd-marca>` (el "live" de la pantalla pasa a ser ese) |
| Monto de la visita en el CTA ("Pagar visita · $50.000") | decisión deliberada documentada en el código | El backend YA tiene `POST /api/ot/tarifa/estimar`: si el producto quiere el monto, se llama al estimador y se pinta el valor REAL, no un hardcode |

## 4. No negociable (protege al usuario, no al gusto)

- **es-CO y tuteo**: los exports crudos traen voseo, `.com.ar`, `tel:+54`, "service", "lavarropas". Eso es un defecto de generación, no el diseño.
- **WCAG AA**: `user-scalable=no`, texto 10–11 px. Los mockups rompen el zoom y el piso de 12 px.
- **No inventar** precios, SLAs ("48 hs"), políticas ("10 minutos de gracia") ni métricas. Los tres primeros ya se encontraron pintados como ficción y se quitaron.

## 5. Decisiones pendientes del dueño

1. ¿Llamamos a `POST /api/ot/tarifa/estimar` y pintamos el monto REAL de la visita en el CTA de A6?
2. ¿Se relaja §4 (KPIs) bajo la condición "solo cifras del backend"?
3. ¿Backend-first para la fila de precios/estimados (tabla de §2), o se queda honesto-vacío hasta que exista la API?

## 6. Radar de faltantes (2026-11-23) — 1:1 UI, funcionalidad, reactividad y backend

### Reactividad / SSE
| Hueco | Estado | Qué falta |
|---|---|---|
| Posición del técnico | poll de 15 s (funciona, visible-tab only); el mock YA simula movimiento progresivo | Para "inDrive real": streaming de posición (SSE/WS) en backend en vez de poll |
| Countdown "Expira en" del radar (B1) | pinta el snapshot de `segundosRestantes` y NO hace tictac: queda congelado | Ticker local + recarga al llegar a 0 (o push de expiración desde backend) |
| Bandeja del proveedor (C0/C1) | sin SSE y sin refresher: nuevas solicitudes solo al recargar | SSE de requerimientos o al menos `ion-refresher` |
| Push de expiración de ofertas | no existe: el radar puede listar ofertas muertas hasta el próximo poll | Evento de expiración por SSE o filtrado server-side al listar |
| SSE en mock | `abrirOtStream` devuelve EMPTY; ya arranca el poll de respaldo (fix del complete silencioso), pero no hay push simulado | El walkthrough multi-rol lo cubre; opcional: simulador de eventos en mock |

### Funcionalidad de producto
- **A3.1**: self-adopt del perfil CLIENTE en móvil (el backend lo soporta, la web ya lo tiene).
- **Chat con el técnico**: A7 muestra el banner honesto "Próximamente"; no hay backend de chat.
- **Notificaciones**: los diseños pintan campanas y badges; no existe sistema push/in-app.
- **Archivos reales**: evidencias fotográficas y documentos siguen siendo metadata-only (no upload).
- **Precio por línea de insumo + catálogo/marketplace**: ver §2 (backend + contrato).

### 1:1 UI pendiente de la campaña de pantallas
- Sin auditar/adaptar aún: **B0 Panel Técnico** (+281/-204, el mayor), **A4 Panel Cliente** (+166/-159), **A8 Pago y acta**, **B3 Ejecución**, A7 (desglose ya corregido; falta la auditoría de diseño completa), B2 Mis OTs, A1/A2 (descargados, no auditados).
- Elementos bloqueados por datos: ver §2. Decisiones pendientes: ver §5.

### Backend (para 1:1 pleno y reactividad real)
- Streaming de posición + push de expiración + SSE de requerimientos a proveedores.
- Campos/endpoints: `precio` en `InsumoLinea`, `matricula` en el perfil, avatar, métricas por rol, catálogo de insumos + flujo de cotización.
