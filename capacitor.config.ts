import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rksucatas.app',
  appName: 'RK Sucatas',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    url: 'https://central-rk-sucatas.onrender.com',
    cleartext: true
  }
};

export default config;
