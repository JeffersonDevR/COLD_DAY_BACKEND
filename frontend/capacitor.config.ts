import type {CapacitorConfig} from '@capacitor/cli';

/**
 * Capacitor shell for the Ionic app. The web app is not wrapped: only the
 * `mobile` Angular project is packaged. Android platform generation
 * (`npx cap add android`) is P1 and needs the Android SDK.
 */
/**
 * En desarrollo contra un backend HTTP en la LAN (o vía adb reverse) la WebView
 * necesita cleartext. Gateado por variable para que producción conserve los
 * defaults seguros: `CAP_DEV_HTTP=1 npm run mobile:build`.
 */
const devHttp = process.env['CAP_DEV_HTTP'] === '1';

const config: CapacitorConfig = {
  appId: 'com.coldday.app',
  appName: 'Cold Day',
  webDir: 'dist/mobile/browser',
  ...(devHttp
    ? {
        server: {cleartext: true},
        android: {allowMixedContent: true},
      }
    : {}),
};

export default config;
