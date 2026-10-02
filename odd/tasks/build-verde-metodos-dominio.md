# Build verde: metodos de dominio faltantes

## Objetivo
Cerrar los 5 errores de compilacion de `main` y dejar el build verde, implementando
los metodos con sus invariantes reales. Sin stubs: un metodo vacio que compila es
peor que un metodo ausente, porque aparenta cobertura.

## Problema
`compileJava` falla con 5 errores. El repo esta a mitad de un refactor en el que los
use cases se escribieron antes que los metodos de dominio que invocan.

## Por que ahora
Sin build verde no se puede validar NADA del resto de la deuda tecnica detectada
(~70 fugas de invariante auditadas). Es la puerta de entrada.

## Alcance autorizado

### WU-1 — Modulo `ot`
- [ ] T1. Migracion `V7__ot_visita_llegada_calificacion.sql`
- [ ] T2. `Ot.confirmarLlegada(ActorOt, Instant)` — hecho, NO transicion
- [ ] T3. `Ot.registrarPagoVisita(String, Instant)`
- [ ] T4. `Ot.calificar(int, String, Instant)` — reemplazar el stub vacio
- [ ] T5. `MotivoCancelacion.LIMPIEZA_SISTEMA` + constraint del enum en V7
- [ ] T6. `OtResponse`: `medioPagoVisita()`, `calificacionEstrellas()`, `calificacionComentario()`
- [ ] T7. `OtJpaEntity` + sobrecarga de `reconstituir`
- [ ] T8. Excepciones tipadas + handlers en `OtControllerAdvice`
- [ ] T9. Tests unitarios de las 4 reglas nuevas
- [ ] T10. `compileJava` + `compileTestJava` verdes

### WU-2 — Modulo `proveedores`
- [ ] T11. Migracion `V8__proveedor_estado_validacion.sql`
- [ ] T12. `Proveedor.estadoValidacion` + `aprobarValidacion` / `rechazarValidacion` / `suspender`
- [ ] T13. Tabla `TransicionesProveedor`
- [ ] T14. Excepcion `TransicionValidacionProveedorInvalidaException` + handler
- [ ] T15. `ProveedorJpaEntity` + `reconstituir` actualizado (estado real, no default)
- [ ] T16. Gate de elegibilidad: `exigirValidado()` en los 4 use cases de insumos
- [ ] T17. Mover la regla de documentos vigentes del use case al agregado
- [ ] T18. Tests

## Fuera de alcance (declarado, no oculto)
- Endpoints HTTP para calificar / confirmar-llegada / pagar-visita / validar-proveedor.
  Los use cases existen pero son inalcanzables por HTTP.
- Las ~70 fugas de invariante del resto de la auditoria.
- Los 2 agujeros de seguridad de `usuarios` (login no consulta `isActivo()`; token
  de reset consumible mas de una vez).

## Restricciones
- **Nunca editar `V1__baseline_esquema_actual.sql`.** Es snapshot y no se re-corre en
  bases ya baselined. Toda columna nueva va en V7+.
- **Ningun campo de dominio sin columna.** Un campo en memoria que la tabla no
  guarda se resetea en cada lectura: data loss silenciosa.
- Patron de constraint a espejar: `tecnico.estado_validacion character varying(255) NOT NULL`
  + `CONSTRAINT <tabla>_<col>_check CHECK (...ARRAY[...])`.
- Patron de sobrecarga: agregar overload nueva + shim delegador, con `@SuppressWarnings("java:S107")`.
  Hay 20 call sites de `Ot.reconstituir` en test + 1 en main que no se deben tocar.

## Criterios de aceptacion
1. `gradlew compileJava compileTestJava` sin errores.
2. `confirmarLlegada` NO cambia el estado (probado por `CalificarOtUseCaseTest:39-51`).
3. Cada metodo nuevo lanza excepcion de dominio tipada, nunca `IllegalStateException` cruda.
4. Cada campo nuevo de dominio tiene columna, mapeo JPA y overload de reconstitucion.
5. Cada regla nueva tiene test que falla sin la implementacion.

## TDD
Resuelto: **off**. No hay evidencia de strict TDD configurado en el proyecto; se corre
la suite existente como red de seguridad. Reportar honestly el resultado real.

## Progreso
_(actualizar por work unit)_

## Evidencia
_(commits)_

## Proximo paso
WU-1
