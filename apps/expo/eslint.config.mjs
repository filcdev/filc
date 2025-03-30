import baseConfig from '@filc/eslint-config/base'
import reactConfig from '@filc/eslint-config/react'

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: ['.expo/**', 'expo-plugins/**']
  },
  ...baseConfig,
  ...reactConfig
]
