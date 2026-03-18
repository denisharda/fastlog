const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const { default: exclusionList } = require(
  path.resolve(__dirname, 'node_modules/metro-config/src/defaults/exclusionList')
);

const config = getDefaultConfig(__dirname);

// Exclude widgets/ directory — compiled natively by expo-widgets, not by Metro
config.resolver.blockList = exclusionList([
  new RegExp(path.resolve(__dirname, 'widgets').replace(/[/\\]/g, '[/\\\\]') + '/.*'),
]);

module.exports = withNativeWind(config, { input: './global.css' });
