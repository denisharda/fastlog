module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
    ],
    plugins: [
      // Required for react-native-reanimated 4 / bottom-sheet — must be last.
      'react-native-worklets/plugin',
    ],
  };
};
