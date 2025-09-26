// app.config.ts
import 'dotenv/config';
import type { ExpoConfig } from 'expo/config';

export default (): ExpoConfig => ({
    name: 'SavdoHisobi',            // Launcher tagidagi nom
    slug: 'savdohisobi',
    scheme: 'wholesaleapp',
    version: '1.0.1',               // App versiyasi (marketing)
    runtimeVersion: '1.0.1',        // EAS Update ishlatsangiz moslang

    experiments: { typedRoutes: true },

    android: {
        package: 'com.ruhshonatortapps.SavdoHisobi',
        versionCode: 2,               // ↑ yangi build uchun oshiring
        permissions: ['CAMERA'],

        // Ikonka: Android’da adaptive icon tavsiya qilinadi
        icon: './assets/App-icon.png', // 48–192px kvadrat (fallback)
        adaptiveIcon: {
            foregroundImage: './assets/App-icon.png', // markaziy logo (transparent fon)
            backgroundColor: '#F6EAD4',                      // fon rangi
            // ixtiyoriy: Android 13 uchun monochrome
            // monochromeImage: './assets/icon-mono.png',
        },
    },

    ios: {
        bundleIdentifier: 'com.ruhshonatortapps.SavdoHisobi',
        // iOS ikonkasi umumiy icon dan olinadi (alohida ios.icon yo‘q)
    },

    // Hozircha OTA URL’ni qo‘lda bermaymiz — EAS o‘zi yozadi
    updates: {
        enabled: true,
        checkAutomatically: 'ON_LOAD',
        fallbackToCacheTimeout: 0,
        "url": "https://u.expo.dev/f3ecb9e7-108f-4388-a74d-a2418c05d415"
    },

    owner: 'ruhshonatortapps',

    // Umumiy ikonka (iOS va eski Androidlar uchun)
    icon: './assets/App-icon.png',

    splash: {
        image: './assets/App-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#F6EAD4',
    },

    extra: {
        SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        "eas": {
            "projectId": "f3ecb9e7-108f-4388-a74d-a2418c05d415"
        }
    },

    plugins: [
        'expo-router',
        'expo-font',
        'expo-secure-store',
        'expo-web-browser',
        // 'expo-dev-client', // Faqat dev client qurmoqchi bo‘lsangiz qoldiring
    ],
});