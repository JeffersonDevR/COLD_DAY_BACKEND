# Archivos en el bucket de Railway — 2026-11-27

Estado: **diseño pendiente de aprobación**.

## Para qué

Hoy no se guarda ningún archivo. Recursos Humanos valida documentos viendo solo tipo y fechas, y Contabilidad aprueba consignaciones viendo solo un número de referencia. Con el bucket (ya creado) pueden ver el soporte desde el panel web.

## Cómo está hoy

- Documentos de técnico y de proveedor: solo datos declarados. El técnico los declara en la pestaña Gestión; el proveedor, en «Mis documentos».
- Consignación: la app envía la referencia por `POST /api/liquidaciones/{id}/comprobante` (campo `comprobanteUrl`).
- Fotos de la app: se quedan en el teléfono.

## Objetivos

1. Técnico y proveedor adjuntan un archivo a cada documento desde la app.
2. El técnico adjunta la foto o PDF del comprobante junto con la referencia.
3. Recursos Humanos abre los documentos y Contabilidad los comprobantes desde la web. El administrador ve ambos.

## Fuera de alcance

- Fotos de las órdenes de trabajo.
- Que el técnico o el proveedor vuelvan a descargar sus archivos.
- Subir archivos desde la web.
- Política de retención y borrado de datos personales (no está definida; hay que acordarla aparte).

## Enfoques

| Enfoque | A favor | En contra |
|---|---|---|
| **1. Subir por el backend, ver con enlace temporal** (elegido por el dueño) | El servidor valida antes de guardar; las llaves no salen de él; sin CORS en el bucket | Los archivos pasan por el servidor; el enlace se puede reenviar mientras no venza |
| 2. Subir directo de la app al bucket | El servidor no carga archivos | Tres pasos que pueden quedar a medias; necesita CORS en el bucket |
| 3. Todo por el backend, también la descarga | Sin enlaces compartibles | Más tráfico y más trabajo en el panel |

## Reglas de negocio (propuestas: revisar)

- Formatos: JPG, PNG o PDF. Máximo 10 MB.
- Documentos: la app pide el archivo al declarar. El servidor sigue aceptando declaraciones sin archivo para no romper las apps ya instaladas. Los documentos antiguos permiten adjuntarlo después.
- Reemplazo de un documento: siempre se puede adjuntar si no tiene archivo; reemplazarlo solo se puede mientras la cuenta no esté aprobada.
- Comprobante: la app exige foto o PDF **y** referencia. El servidor acepta solo la referencia (apps antiguas). Se puede reemplazar mientras la liquidación esté pendiente o rechazada.
- Un documento sin archivo se muestra como «Sin archivo» y no impide aprobar: lo decide quien valida.

## Diseño

### Almacenamiento

- Puerto `AlmacenArchivos` (guardar, enlace temporal) en `shared`, con adaptador S3 (AWS SDK v2, dependencia nueva) para el bucket de Railway. Railway usa direcciones con el nombre del bucket como subdominio.
- Bucket privado. Clave generada por el servidor: `documentos/tecnicos/{tecnicoId}/{uuid}.{ext}`, `documentos/proveedores/{proveedorId}/{uuid}.{ext}`, `comprobantes/{liquidacionId}/{uuid}.{ext}`. El nombre original no forma parte de la clave.
- Reemplazar guarda un objeto nuevo y apunta a él; el anterior no se borra.
- Variables: endpoint, región, nombre del bucket, access key y secret key, solo por entorno y documentadas en `backend/.env.example`. En Railway se enlazan desde el bucket al servicio del backend.
- Sin esas variables la app arranca y las rutas de archivo responden 503; lo demás funciona.
- En local y en pruebas, sin bucket real: las pruebas usan un almacén en memoria.

### Datos

Migración `V24`: columnas opcionales para clave, tipo de contenido y fecha de carga en documentos de técnico, documentos de proveedor y liquidaciones. `comprobanteUrl` sigue guardando la referencia.

### API

| Ruta | Quién |
|---|---|
| `POST /api/tecnicos/me/documentos/{docId}/archivo` | Técnico dueño |
| `POST /api/proveedores/me/documentos/{docId}/archivo` | Proveedor dueño |
| `POST /api/liquidaciones/{id}/comprobante/archivo` | Técnico dueño |
| `GET /api/tecnicos/{id}/documentos/{docId}/archivo` | `VALIDAR_DOCUMENTACION` |
| `GET /api/proveedores/{id}/documentos/{docId}/archivo` | `VALIDAR_DOCUMENTACION` |
| `GET /api/admin/liquidaciones/{id}/comprobante/archivo` | `GESTIONAR_CONSIGNACIONES` |

- Las subidas son multipart. El tipo se comprueba por el contenido del archivo, no por la extensión ni por lo que diga el cliente. Tipo o tamaño inválido: 400 con mensaje claro. Documento ajeno o inexistente: 404 o 403, como en el resto del módulo.
- Las consultas devuelven un enlace que vence en 5 minutos. El enlace no se guarda ni se registra en logs.
- Las listas de documentos y liquidaciones indican `tieneArchivo`; nunca devuelven la clave.
- Los permisos actuales no cambian. Las rutas nuevas se declaran en `SecurityConfig` antes de la regla general de `/api/admin/**`.

### App móvil

- Selector de archivo estándar (cámara, galería o PDF), sin dependencias nuevas.
- Declarar y subir es un solo botón. Si la subida falla, el documento queda «Sin archivo» con la opción «Adjuntar archivo».
- En el comprobante se sube primero el archivo y solo si sale bien se envía la referencia.
- Hace falta publicar un APK nuevo.

### Panel web

- Auditoría de técnicos y Proveedores: botón «Ver archivo» por documento, o «Sin archivo».
- Conciliación: «Ver comprobante» junto a la referencia.
- Abre en otra pestaña (abrirla al hacer clic y asignar el enlace después, para que no la bloquee el navegador).

## Orden de entrega

1. Backend: almacén, migración, rutas y pruebas.
2. Web: ver archivos.
3. App: adjuntar.

Cada paso funciona sin el siguiente.

## Cómo se comprueba

- Backend: por cada ruta, 401, 403 y camino feliz; además formato inválido, tamaño excedido, documento de otro, reemplazo no permitido y bucket sin configurar. Las pruebas con base de datos necesitan Docker.
- Web y app: specs de las pantallas tocadas.
- `npm run ui:check` y `node scripts/check-backend-rules.mjs` sin que suba ningún techo.
- Con el bucket real: subir un archivo desde la app y abrirlo en el panel. Las llaves las pone el dueño en Railway; no van al repositorio ni al chat.

## Queda a criterio de quien implementa

Nombres de clases y columnas, textos exactos (tuteo), y cómo se prueba contra el bucket en local si hace falta.
