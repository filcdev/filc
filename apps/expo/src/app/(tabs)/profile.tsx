import { useState } from 'react'
import { Button, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack } from 'expo-router'

import BackgroundGradient from '@/ui/core/BackgroundGradient'
import { useSignIn, useSignOut, useUser } from '@/utils/auth'

const LogInScreen = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const signIn = useSignIn()

  return (
    <View className="flex flex-col items-center">
      <Text className="text-foreground mb-4 text-lg font-semibold">Log In</Text>
      <TextInput
        placeholder="Email"
        className="bg-muted w-full rounded-md p-2 text-sm"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        placeholder="Password"
        className="bg-muted w-full rounded-md p-2 text-sm"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button
        title="Log In"
        onPress={async () => {
          await signIn(email, password)
        }}
      />
    </View>
  )
}

const MobileAuth = () => {
  const user = useUser()
  const signOut = useSignOut()

  if (user) {
    return (
      <View className="flex flex-row items-center justify-between">
        <Text className="text-foreground text-lg font-semibold">
          {user.username}
        </Text>
        <Button
          title="Sign Out"
          onPress={async () => {
            await signOut()
          }}
        />
      </View>
    )
  }

  return <LogInScreen />
}

const Index = () => {
  return (
    <SafeAreaView className="bg-background">
      {/* Changes page title visible on the header */}
      <Stack.Screen options={{ title: 'Home Page' }} />
      <View className="bg-background h-full w-full p-4">
        <Text className="text-foreground pb-2 text-center text-5xl font-bold">
          Create <Text className="text-primary">T3</Text> Turbo
        </Text>

        <MobileAuth />

        <View className="py-2">
          <Text className="text-primary font-semibold italic">
            Press on a post
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

export default Index
