import {Stack} from "expo-router";
import "./globals.css";
import {LinearGradient} from "expo-linear-gradient";

export default function RootLayout() {
    return <Stack>
        <Stack.Screen name="index" options={{headerShown: false}}/>
    </Stack>;
}
