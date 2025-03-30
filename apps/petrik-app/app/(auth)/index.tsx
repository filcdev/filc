import { Text, View, TouchableOpacity } from "react-native";
import { useSession } from "../../utils/auth_context";
import BackGroundLinearGradient from "@/ui/core/background";

export default function Index() {
  const { session, signOut } = useSession();

  return (
    <BackGroundLinearGradient>
      <View className="flex-1 items-center justify-center p-4">
        <Text className="mb-4 text-xl text-white">
          Welcome back!
        </Text>
        <TouchableOpacity
          className="rounded-lg bg-red-500 px-4 py-2"
          onPress={signOut}
        >
          <Text className="text-white">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </BackGroundLinearGradient>
  );
}
