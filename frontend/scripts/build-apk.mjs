// Genera el APK de depuración: wrapper multiplataforma sobre Gradle.
//
// El APK NO sale de `ng build`: Angular produce el bundle web y Capacitor lo
// copia al proyecto Android (`cap sync`); Gradle es quien empaqueta. Este script
// existe para que `npm run mobile:apk` funcione igual en Windows y en Linux/CI.
//
// Requisitos: Android SDK (sdk.dir en android/local.properties) y JDK 21+.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const androidDir = resolve(here, '..', 'android');

if (!existsSync(androidDir)) {
  console.error(
    '[apk] No existe frontend/android. Generá la plataforma con:\n  npx cap add android',
  );
  process.exit(1);
}
const localProperties = resolve(androidDir, 'local.properties');
if (!existsSync(localProperties)) {
  console.error(
    '[apk] Falta android/local.properties con sdk.dir. Copiá la ruta del SDK de Android\n' +
      '     (Android Studio → SDK Manager) o pasala con ANDROID_HOME.',
  );
  process.exit(1);
}

// Gradle lee local.properties como ISO-8859-1: un BOM UTF-8 se vuelve parte del
// nombre de la clave (`\uFEFFsdk.dir`) y el build falla con "SDK location not
// found" aunque el SDK esté instalado. Pasa cuando alguien crea el archivo con
// PowerShell. Se corrige en el momento en vez de dejar el error opaco.
const crudo = readFileSync(localProperties, 'utf8');
if (crudo.charCodeAt(0) === 0xfeff) {
  writeFileSync(localProperties, crudo.replace(/^\uFEFF/, ''), 'utf8');
  console.warn('[apk] android/local.properties tenía BOM; se reescribió sin BOM.');
}

const esWindows = process.platform === 'win32';
const tarea = process.argv[2] === 'bundle' ? 'bundleRelease' : 'assembleDebug';

// En Windows un `.bat` necesita cmd.exe; se invoca explícitamente en vez de
// `shell: true` con argumentos (que Node marca como inseguro).
const resultado = esWindows
  ? spawnSync('cmd.exe', ['/c', 'gradlew.bat', tarea], { cwd: androidDir, stdio: 'inherit' })
  : spawnSync('./gradlew', [tarea], { cwd: androidDir, stdio: 'inherit' });

if (resultado.status !== 0) {
  console.error(`[apk] Gradle falló ejecutando ${tarea} (código ${resultado.status}).`);
  process.exit(resultado.status ?? 1);
}

console.log(
  tarea === 'bundleRelease'
    ? '[apk] AAB firmado en android/app/build/outputs/bundle/release (requiere keystore configurado).'
    : '[apk] APK de depuración en android/app/build/outputs/apk/debug/app-debug.apk',
);
