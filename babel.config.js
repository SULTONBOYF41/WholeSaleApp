// babel.config.js
module.exports = function (api) {
    api.cache(true);
    return {
        presets: ["babel-preset-expo"], // eski expo-router/babel kerak emas
        plugins: ["react-native-worklets/plugin"], // yangi reanimated plugin
    };
};
