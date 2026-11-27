# Preparar iOS (solo documentado, no ejecutar)

Estado al 2026-11-26: **en espera**. El dueño pidió dejarlo escrito y no hacer nada de este plan. Publicar en iPhone está pendiente de validar con su jefe. No ejecutes ningún paso sin que lo pidan.

## Punto de partida

- Solo existe `frontend/android`. No hay carpeta `frontend/ios` ni dependencia `@capacitor/ios`.
- `frontend/capacitor.config.ts`: `appId` = `com.coldday.app`, `webDir` = `dist/mobile/browser`.

## Qué habría que hacer

1. Añadir `@capacitor/ios` (misma versión mayor que `@capacitor/core`) y generar la plataforma con `npx cap add ios`.
2. En `Info.plist`, escribir los textos de permiso de ubicación, cámara y fototeca (en tuteo). Sin ellos iOS cierra la app al pedir el permiso.
3. Revisar que `CORS_ALLOWED_ORIGINS` de producción incluya `capacitor://localhost`.
4. Push: capacidad de notificaciones, clave APNs y su registro en Firebase.
5. Revisar en iPhone: áreas seguras, teclado, navegación atrás, mapas y SSE al pasar a segundo plano.
6. Iconos y splash.
7. Distribución: firma, TestFlight y ficha de App Store.

## Qué hace falta que no está en este equipo

- Un Mac con Xcode para compilar y probar; en Windows no se puede.
- Cuenta de Apple Developer (de pago, anual) para TestFlight, push y publicación.
- Un iPhone físico para probar cámara, GPS y push.

## Decisiones pendientes

- ¿Se publica en iPhone? (jefe)
- ¿A nombre de quién queda la cuenta de Apple Developer?
