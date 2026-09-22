import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pogonboskrupa.pp',
  appName: 'Priprema Proizvodnje',
  webDir: 'out',
  server: {
    // Učitava live GitHub Pages URL — APK uvijek koristi najnoviju verziju
    url: 'https://pogonboskrupa.github.io/Priprema_proizvodnje/',
    cleartext: false,
  },
  android: {
    backgroundColor: '#f9fafb',
  },
};

export default config;
