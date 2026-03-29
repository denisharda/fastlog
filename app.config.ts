import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'FastBuddy',
  slug: 'fastbuddy',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'fastbuddy',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#F2F2F7',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.fastbuddy.app',
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
    package: 'com.fastbuddy.app',
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
        bundleIdentifier: 'com.fastbuddy.app.widgets',
        groupIdentifier: 'group.com.fastbuddy.app',
        enablePushNotifications: true,
        widgets: [
          {
            name: 'FastingWidget',
            displayName: 'Fasting Timer',
            description: 'Track your fasting progress',
            supportedFamilies: ['systemSmall', 'systemMedium'],
          },
        ],
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
});
