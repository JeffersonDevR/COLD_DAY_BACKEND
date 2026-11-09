import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Router } from '@angular/router';

/**
 * Enlaces profundos (App Links / custom scheme).
 *
 * <p><b>Estado:</b> contrato y mapeo listos, desactivados. La app todavía no está
 * publicada, así que no hay dominio ni huella de firma que declarar. Para
 * activarlos hay que hacer tres cosas y solo una toca código:
 *
 * <ol>
 * <li>Definir el dominio final y ponerlo en {@link DEEP_LINKS_HOSTS}.</li>
 * <li>Poner `habilitado: true` en {@link DEEP_LINKS}.</li>
 * <li>Declarar el intent-filter en el manifiesto Android. El bloque, con el
 * host a reemplazar, es este:
 *
 * <pre>{@code
 * <intent-filter android:autoVerify="true">
 *   <action android:name="android.intent.action.VIEW" />
 *   <category android:name="android.intent.category.DEFAULT" />
 *   <category android:name="android.intent.category.BROWSABLE" />
 *   <data android:scheme="https" android:host="REEMPLAZAR_POR_EL_DOMINIO" />
 * </intent-filter>
 * <intent-filter>
 *   <action android:name="android.intent.action.VIEW" />
 *   <category android:name="android.intent.category.DEFAULT" />
 *   <category android:name="android.intent.category.BROWSABLE" />
 *   <data android:scheme="coldday" />
 * </intent-filter>
 * }</pre>
 *
 * Para App Links verificados hace falta además servir
 * `https://<dominio>/.well-known/assetlinks.json` con la huella SHA-256 del
 * keystore. Mientras falte eso, el sistema abre el navegador en vez de la app.
 * </li>
 * </ol>
 *
 * Mientras `habilitado` sea `false` el listener ni se registra: la app funciona
 * igual y no hay riesgo de navegar a una ruta por un enlace de un dominio ajeno.
 */
export interface DeepLinkConfig {
  readonly habilitado: boolean;
  /** Hosts exactos aceptados (sin esquema, en minúsculas). */
  readonly hosts: readonly string[];
  /** Esquemas propios aceptados (`coldday://ot/<id>`). */
  readonly esquemas: readonly string[];
}

/** PLACEHOLDER: reemplazar por el dominio real cuando exista la publicación. */
export const DEEP_LINKS_HOSTS: readonly string[] = ['coldday.co', 'www.coldday.co'];

export const DEEP_LINKS: DeepLinkConfig = {
  habilitado: false,
  hosts: DEEP_LINKS_HOSTS,
  esquemas: ['coldday'],
};

/**
 * Traduce una URL entrante a una ruta interna, o `null` si no aplica.
 *
 * Es una función pura a propósito: el mapeo se puede probar sin Capacitor y el
 * listener solo navega cuando esto devuelve algo.
 */
export function rutaDeDeepLink(url: string, config: DeepLinkConfig = DEEP_LINKS): string | null {
  if (!config.habilitado) {
    return null;
  }

  let analizada: URL;
  try {
    analizada = new URL(url);
  } catch {
    return null;
  }

  const esquema = analizada.protocol.replace(/:$/, '').toLowerCase();
  const host = analizada.hostname.toLowerCase();
  const esEsquemaPropio = config.esquemas.includes(esquema);
  const esHostAceptado = host !== '' && config.hosts.includes(host);
  if (!esEsquemaPropio && !esHostAceptado) {
    return null;
  }

  // Ojo: en una URL de esquema propio (`coldday://tecnico/ejecucion/x`) el primer
  // segmento NO está en el path: `new URL` lo pone en `hostname`. Se normaliza
  // para que el resto del mapeo trabaje con una sola lista de segmentos.
  const segmentosPath = analizada.pathname.split('/').filter(Boolean);
  const partes = esEsquemaPropio && !esHostAceptado ? [host, ...segmentosPath] : segmentosPath;
  if (partes.length === 0) {
    return null;
  }

  // https://<host>/ot/<id> → seguimiento de la OT del cliente.
  if (partes[0] === 'ot' && esIdValido(partes[1])) {
    return `/cliente/ot/${partes[1]}`;
  }
  // coldday://tecnico/ejecucion/<id> → ejecución de la OT asignada.
  if (partes[0] === 'tecnico' && partes[1] === 'ejecucion' && esIdValido(partes[2])) {
    return `/tecnico/ejecucion/${partes[2]}`;
  }
  if (partes[0] === 'tecnico' && partes[1] === 'liquidaciones') {
    return '/tecnico/liquidaciones';
  }
  if (partes[0] === 'cliente' && partes[1] === 'panel') {
    return '/cliente/panel';
  }
  if (partes[0] === 'proveedor' && partes[1] === 'insumos') {
    return '/proveedor/insumos';
  }
  return null;
}

/**
 * Los ids de la API son UUID; se exige esa forma antes de interpolarlos en una
 * ruta. Un id con `%`, `#`, `?` o barras no llega al router.
 */
function esIdValido(valor: string | undefined): valor is string {
  return valor !== undefined && /^[0-9a-zA-Z-]{1,64}$/.test(valor);
}

/**
 * Suscribe el router a los enlaces entrantes. No-op si está deshabilitado o si
 * corre en web (`ng serve`), donde los enlaces los resuelve el navegador.
 */
export function registrarDeepLinks(router: Router, config: DeepLinkConfig = DEEP_LINKS): void {
  if (!config.habilitado || !Capacitor.isNativePlatform()) {
    return;
  }

  void App.addListener('appUrlOpen', ({ url }) => {
    const ruta = rutaDeDeepLink(url, config);
    if (ruta) {
      void router.navigateByUrl(ruta);
    }
  });
}
