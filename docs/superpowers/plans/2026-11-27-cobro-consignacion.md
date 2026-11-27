# Cobro, comisión y consignación Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Al finalizar queda registrado el cobro y el técnico bloqueado hasta consignar, y puede enviar su referencia.

**Spec:** `docs/superpowers/specs/2026-11-27-cobro-comision-consignacion-design.md`

## Global Constraints

- Comisión 15 % (`app.liquidacion.comision-porcentaje`) sobre presupuesto + visita. Sin presupuesto no hay liquidación.
- Sin migraciones: la referencia va en `comprobanteUrl`. Sin cambios a las reglas de dominio del técnico.
- `check-backend-rules` y `ui:check` sin subir techos.

## Review Focus

1. APK anterior: finaliza sin cuerpo → se registra como `EFECTIVO` y funciona (Task 1).
2. Orden que ya tiene liquidación: no se duplica ni falla (Task 1).
3. Técnico suspendido a mitad de la orden: finaliza, queda la liquidación y no falla (Task 1).
4. «Fuera de servicio» y luego «Disponible» con deuda: 409 con el motivo (Task 2).
5. Referencia vacía o rechazada: no se envía vacía; tras un rechazo se puede reenviar (Task 3).

### Task 1: Finalizar liquida y bloquea

`FinalizarOtUseCase.finalizar(UsuarioId, OtId, MedioPago)` (la de dos argumentos usa `EFECTIVO`); `POST /api/ot/{id}/finalizar` con cuerpo opcional `{medioPago}`. Total = presupuesto + tarifa de visita autoritativa. Publica `LiquidacionRegistrada`.

### Task 2: No se puede saltar

`CambiarDisponibilidadUseCase` (al pasar a `DISPONIBLE`) y `AceptarOfertaUseCase` rechazan con `TecnicoBloqueadoPorLiquidacionException` (409) si `existeBloqueadoraPara`.

### Task 3: App

Ejecución: valor a cobrar (presupuesto + visita, estimada con `estimarTarifa` si aún no está registrada), comisión 15 %, aviso de bloqueo, botón «Finalizar y cobrar», envía `medioPago`. Gestión: en `PENDIENTE_CONSIGNACION` y `RECHAZADA`, campo «Número de referencia» y «Enviar referencia». Textos que mandaban a la web.

### Task 4: Consola y verificación

La bandeja de consignaciones muestra la referencia como texto si no es un enlace. `gradlew build`, tests web y móvil, APK.
