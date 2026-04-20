import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'FastLog',
  slug: 'fastlog',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'fastlog',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#FBF6EE',
    dark: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#17110A',
    },
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.fastlog.app',
    infoPlist: {
      UIBackgroundModes: ['fetch', 'remote-notification'],
      NSSupportsLiveActivities: true,
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FBF6EE',
    },
    package: 'com.fastlog.app',
  },
  web: {
    bundler: 'metro',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-notifications',
    [
      'expo-build-properties',
      {
        ios: {
          useFrameworks: 'static',
        },
      },
    ],
    [
      './plugins/withFastLogWidget/app.plugin.js',
      {
        bundleIdentifier: 'com.fastlog.app.widgets',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
});
