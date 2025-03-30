import {Text, View} from "react-native";
import {Link} from "expo-router";
import BackGroundLinearGradient from "@/ui/core/background";
import Slider from "@/ui/components/slider/slider";


export default function Index() {
    return (
        <BackGroundLinearGradient>
            <Slider/>
        </BackGroundLinearGradient>
    )
}
