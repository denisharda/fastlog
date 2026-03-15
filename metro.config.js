const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Exclude widgets/ directory — compiled natively by expo-widgets, not by Metro
config.resolver.blockList = [
  ...(config.resolver.blockList ? [config.resolver.blockList] : []),
  new RegExp(path.resolve(__dirname, 'widgets') + '/.*'),
];

module.exports = withNativeWind(config, { input: './global.css' });
