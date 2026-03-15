import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'FastAI',
  slug: 'fastai',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'fastai',
  userInterfaceStyle: 'dark',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0A0A0A',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.fastai.app',
    infoPlist: {
      UIBackgroundModes: ['fetch', 'remote-notification'],
      NSSupportsLiveActivities: true,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0A0A0A',
    },
    package: 'com.fastai.app',
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
    '@react-native-google-signin/google-signin',
    [
      '@bittingz/expo-widgets',
      {
        ios: {
          src: './widgets',
          devTeamId: 'TEAM_ID', // Replace with actual team ID before prebuild
          mode: 'production',
          useLiveActivities: true,
          entitlements: {
            'com.apple.security.application-groups': ['group.com.fastai.app'],
          },
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
});
