import {Text, View} from "react-native";
import {Link} from "expo-router";
import BackGroundLinearGradient from "@/ui/core/background";


export default function Index() {
    return (
        <BackGroundLinearGradient>
            <View className="flex-1 items-center justify-center">
                <Text>PetrikAppAlma</Text>
                <Link href="/loginpage" className="text-blue-500 p-4 bg-primary">Alma</Link>
            </View>
        </BackGroundLinearGradient>
    )
}
