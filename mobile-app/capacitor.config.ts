import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.healthsync.alert',
  appName: 'HealthSync Alert',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
  },
};

export default config;
