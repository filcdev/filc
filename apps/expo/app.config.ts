import type { ConfigContext, ExpoConfig } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Filc',
  slug: 'filc',
  scheme: 'filc',
  version: '0.0.1',
  orientation: 'portrait',
  icon: './assets/icon-light.png',
  userInterfaceStyle: 'automatic',
  updates: {
    fallbackToCacheTimeout: 0
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    bundleIdentifier: 'space.filc.mobile',
    supportsTablet: true,
    icon: {
      light: './assets/icon-light.png',
      dark: './assets/icon-dark.png'
      // tinted: "",
    }
  },
  android: {
    package: 'space.filc.mobile',
    adaptiveIcon: {
      foregroundImage: './assets/icon-light.png',
      backgroundColor: '#1F104A'
    }
  },
  // extra: {
  //   eas: {
  //     projectId: "your-eas-project-id",
  //   },
  // },
  experiments: {
    tsconfigPaths: true,
    typedRoutes: true
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#E4E4E7',
        image: './assets/icon-light.png',
        dark: {
          backgroundColor: '#18181B',
          image: './assets/icon-dark.png'
        }
      }
    ]
  ]
})
