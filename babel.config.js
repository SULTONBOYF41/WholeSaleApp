// babel.config.js
module.exports = function (api) {
    api.cache(true);
    return {
        presets: ["babel-preset-expo"],        // ✅ SDK 50 uchun shu yetarli
        plugins: [
            ["module-resolver", { alias: { "@": "." } }],
            "react-native-reanimated/plugin",    // ⚠️ HAR DOIM OXIRIDA
        ],
    };
};
