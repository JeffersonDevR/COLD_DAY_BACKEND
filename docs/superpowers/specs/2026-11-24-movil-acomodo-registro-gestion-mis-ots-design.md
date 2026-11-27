# Acomodo móvil: Registro, Gestión y Mis OTs (diseño corto)

## Intención
Las tres pantallas se ven desordenadas en el teléfono real: el registro obliga a hacer scroll y el ojo de la contraseña queda lejos del campo; las liquidaciones no se distinguen entre sí; el estado del técnico repite información y se ve apretado. Después se revisan otras pantallas con los mismos errores.

## Objetivos
- Registro completo visible sin scroll (o con el mínimo) en 360×640.
- Cada liquidación se lee como una unidad (tarjeta propia).
- Mis OTs: cada dato de estado aparece una sola vez.

## No objetivos
- No tocar backend, rutas, endpoints ni lógica de negocio.
- No cambiar tokens ni crear componentes nuevos fuera de §5 de DESIGN.md.
- No tocar lo que no sea de estas tres pantallas hasta presentar la lista de la revisión final.

## Restricciones
DESIGN.md: campo 48 px, target ≥44, UI-T3 (mono solo para datos), máx. 2 niveles de contenedor, un botón/una ruta, tuteo (UI-L1). Verificadores obligatorios: `npm run ui:check` y specs móviles, sin subir techos del baseline.

## Enfoque elegido (único razonable)
Ajustar el HTML y el CSS existentes; sin componentes nuevos.

1. **Registro** (`registro.page.ts`, `.cd-form` en `pantallas.css`)
   - Se elimina el campo «Repetí la contraseña» y su validador `contrasenasDistintas` (decisión del dueño).
   - El ojo pasa a `slot="end"` dentro del campo de contraseña, como en el login. Se borra `.cd-auth__ojo` suelto.
   - Etiquetas cortas en frase (no mayúsculas mono) para que cada campo mida 48 px.
   - Una sola cabecera: se quita la fila «Cold Day · Ops CO / Fase registro» y el bloque logo + wordmark + frase; queda la barra «Crear cuenta» (decisión mía; se puede revertir).
   - Texto legal corto y sin enlace (la app no tiene ruta de política). La redacción nueva debe validarla quien responda por lo legal (decisión mía).
   - Copy a tuteo y actualización del spec en el mismo commit.
2. **Gestión** (`liquidaciones-tecnico.page.html`)
   - Cada liquidación es una tarjeta con fondo y borde. Arriba va la OT y el chip de estado, en medio la comisión a transferir en grande, abajo fecha, medio y servicio total en gris.
   - Fecha en formato correcto de `es-CO` («10 de oct de 2026»).
3. **Mis OTs** (`panel-tecnico.page.html`)
   - Se quita el subtítulo «Cuenta habilitada…» cuando está aprobada; el aviso de no habilitada se conserva.
   - Se quita el chip «Visible en el radar». La visibilidad pasa a ser el texto de estado del toggle.
   - Disponibilidad: tres opciones en tres columnas iguales. Se elimina la nota fija «Bloqueada con una OT en curso»: la app no sabe de antemano si hay una OT en curso y el 409 ya se explica con un aviso (decisión mía).
4. **Revisión final:** repaso de `documentos-proveedor`, `solicitudes-proveedor`, `ejecucion-ot`, `cuenta` y `perfil-tecnico` y entrega de la lista de hallazgos. No se corrige nada ahí sin aprobación.

## Ajustes a DESIGN.md (aprobados por el dueño, con justificación)
- §5 Campo: «El control que revela o limpia el valor (ojo de contraseña) va dentro del campo, en `slot="end"`, nunca como botón suelto». Justificación: la regla no lo decía y Registro lo hizo distinto del login.
- §5 Tarjeta: «Cada elemento repetido de una lista de datos (liquidación, documento) es una tarjeta con fondo y borde propios». Justificación: en Gestión `article.cd-ot` no tiene fondo ni borde y las liquidaciones no se distinguen.

## Alternativas descartadas
- Wizard de registro por pasos: más toques para tres campos; no resuelve el problema real (tamaño de campos).
- Mantener «Repetir contraseña» compacto: descartado por el dueño.

## Queda para quien construya
Medidas exactas, estados vacío/carga/error ya existentes (no cambian) y ajuste de specs afectados.
