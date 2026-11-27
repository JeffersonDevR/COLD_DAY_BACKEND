# Pantallas de trabajo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** En ejecución, diagnóstico y pago se lee primero lo que importa y la acción va en el pie.

**Spec:** `docs/superpowers/specs/2026-11-27-pantallas-de-trabajo-design.md`

## Global Constraints

- Solo `frontend/projects/mobile/src/` y `docs/design/NAVEGACION.md`; sin colores, fuentes ni radios nuevos; `ui:check` sin subir techos; tuteo; `data-testid` conservados.
- No cambia la aritmética de montos ni las reglas de negocio. El cobro es otro plan.

## Review Focus

1. Orden sin presupuesto: no se muestra un total engañoso (Tasks 1 y 2).
2. Visita sin pagar: «Iniciar desplazamiento» sigue deshabilitado en el pie (Task 3).
3. Enviar diagnóstico incompleto desde el pie: aparecen los errores (Task 3).
4. Con presupuesto enviado no queda ninguna acción en el pie (Task 3).
5. Aviso de proveedor atrasado: sus botones no compiten con la acción del pie (Task 3).

### Task 1: Diagnóstico y presupuesto

`section.cd-dato[data-testid="dato-dominante"]` antes de todo: con presupuesto, el total (`formatoTotal(totalServicio())`) y «Total a autorizar»; sin presupuesto, «Presupuesto pendiente». El desglose sube y el dictamen baja. «Explicá» → «Explica».

### Task 2: Pago y acta

Mismo bloque con «Total del servicio» (o «Por confirmar»). «Dibujá tu firma acá» → «Dibuja tu firma aquí».

### Task 3: Ejecución

- Bloque `dato-dominante` con el paso: `Visita pendiente de pago` / `Lista para salir` / `En camino` / `Diagnóstico` / `Esperando al cliente` / `En reparación` / `Servicio finalizado`; debajo la dirección.
- Un solo `ion-footer.cd-footer` con la acción del paso: `iniciar-desplazamiento`, `llegar`, `enviar-diagnostico` (fuera del formulario, `(click)`), `finalizar-servicio`, «Volver a Mis OTs».
- Cierre: `data-testid="valor-a-cobrar"` = presupuesto + tarifa de visita; sin presupuesto no se pinta.
- Botones del aviso de proveedor atrasado: `cd-cta--secundaria`.

### Task 4: Verificación

`NAVEGACION.md` §3; `ui:check`, `mobile:test`, `mobile:build`, APK. Un commit por pantalla.
