import {Text, View} from "react-native";
import {Link} from "expo-router";
import {LinearGradient} from "expo-linear-gradient";
import BackGroundLinearGradient from "@/app/ui/core/background";


export default function Index() {
    return (
        <BackGroundLinearGradient>
            <View className="flex-1 items-center justify-center">
                <Text>PetrikAppAlma</Text>
                <Link href="/loginpage" className="text-blue-500">Alma</Link>
            </View>
        </BackGroundLinearGradient>
    )
}
