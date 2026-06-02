import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pathguard.app',
  appName: 'PathGuard',
  webDir: 'public',
  server: {
    url: 'https://path-guard-orpin.vercel.app',
    cleartext: false,
  },
};

export default config;
