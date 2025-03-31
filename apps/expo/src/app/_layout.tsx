import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from 'nativewind'

import { queryClient } from '@/utils/api'

import '../styles.css'

import { QueryClientProvider } from '@tanstack/react-query'

export default function RootLayout() {
  const { colorScheme } = useColorScheme()
  return (
    <QueryClientProvider client={queryClient}>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#f472b6'
          },
          contentStyle: {
            backgroundColor: 'transparent'
          }
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar />
    </QueryClientProvider>
  )
}
