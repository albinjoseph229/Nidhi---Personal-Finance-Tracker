module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Your existing module-resolver plugin
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './',
          },
        },
      ],
      // Add the reanimated plugin LAST
      'react-native-reanimated/plugin',
    ],
  };
};