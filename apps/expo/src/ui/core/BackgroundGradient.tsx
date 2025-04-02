import type { ReactNode } from 'react'
import React from 'react'
import { Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

const BackgroundGradient = ({ children }: { children: ReactNode }) => {
  return (
    <View className="h-full w-full">
      <LinearGradient colors={['#076653', '#06231D']}>
        <View className="h-full w-full">{children}</View>
      </LinearGradient>
    </View>
  )
}

export default BackgroundGradient
