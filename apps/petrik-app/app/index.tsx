import { Text, View, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import BackGroundLinearGradient from "@/ui/core/background";
import { useSession } from "../utils/auth_context";

export default function Index() {
  const router = useRouter();
  const { session } = useSession();

  return (
    <BackGroundLinearGradient>
      <View className="flex-1 items-center justify-center p-4 space-y-4">
        <Text className="text-2xl text-white font-bold">
          Üdv a Petrick Appban!
        </Text>
        
        {!session ? (
          <TouchableOpacity
            className="rounded-lg bg-primary px-6 py-3"
            onPress={() => router.push('/sign-in')}
          >
            <Text className="text-black font-semibold">Bejelentkezés</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            className="rounded-lg bg-primary px-6 py-3"
            onPress={() => router.push('/(auth)')}
          >
            <Text className="text-black font-semibold">Dashboard</Text>
          </TouchableOpacity>
        )}
      </View>
    </BackGroundLinearGradient>
  );
}
