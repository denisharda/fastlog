import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'FastLog',
  slug: 'fastlog',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'fastlog',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#F2F2F7',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.fastlog.app',
    infoPlist: {
      UIBackgroundModes: ['fetch', 'remote-notification'],
      NSSupportsLiveActivities: true,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#F2F2F7',
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
      'expo-widgets',
      {
        bundleIdentifier: 'com.fastlog.app.widgets',
        groupIdentifier: 'group.com.fastlog.app',
        enablePushNotifications: true,
        widgets: [
          {
            name: 'FastingWidget',
            displayName: 'Fasting Timer',
            description: 'Track your fasting progress',
            supportedFamilies: ['systemSmall', 'systemMedium'],
          },
        ],
        liveActivities: [
          {
            name: 'FastingActivity',
          },
        ],
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
});
