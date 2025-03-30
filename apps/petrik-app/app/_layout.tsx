import { Stack } from "expo-router";
import "./globals.css";
import { LinearGradient } from "expo-linear-gradient";
import { SessionProvider } from "../utils/auth_context";
import { View } from "react-native";

export default function RootLayout() {
    return (
        <SessionProvider>
            <View className="flex-1">
                <Stack
                    screenOptions={{
                        headerShown: true,
                        contentStyle: {
                            backgroundColor: 'transparent',
                        },
                    }}
                >
                    <Stack.Screen 
                        name="index" 
                        options={{
                            headerShown: false
                        }}
                    />
                    <Stack.Screen 
                        name="sign-in" 
                        options={{
                            headerShown: false
                        }}
                    />
                    <Stack.Screen 
                        name="(auth)" 
                        options={{
                            headerShown: false
                        }}
                    />
                </Stack>
            </View>
        </SessionProvider>
    )
}
