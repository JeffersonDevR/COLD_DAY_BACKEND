import type {CapacitorConfig} from '@capacitor/cli';

/**
 * Capacitor shell for the Ionic app. The web app is not wrapped: only the
 * `mobile` Angular project is packaged. Android platform generation
 * (`npx cap add android`) is P1 and needs the Android SDK.
 */
const config: CapacitorConfig = {
  appId: 'com.coldday.app',
  appName: 'Cold Day',
  webDir: 'dist/mobile/browser',
};

export default config;
