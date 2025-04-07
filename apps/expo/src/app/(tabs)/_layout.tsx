import { Tabs } from 'expo-router'
import FontAwesome from '@expo/vector-icons/FontAwesome'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'transparent',
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 0,
          borderTopWidth: 0
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Helyettesítések',
          tabBarIcon: ({ color }) => (
            <FontAwesome size={28} name="users" color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: 'Hírek',
          tabBarIcon: ({ color }) => (
            <FontAwesome size={28} name="newspaper-o" color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => (
            <FontAwesome size={28} name="user" color={color} />
          )
        }}
      />
    </Tabs>
  )
}
