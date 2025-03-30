import {SliderItemType} from "@/ui/components/slider/types/slider_types";

export class SliderData {
    static readonly list: SliderItemType[] = [
        {
            title: "Üdv a petrik appban",
            image: require("@/assets/images/react-logo.png"),
            description: "Egy egyszerűbb út a Petrikes élethez.",
        },
        {
            title: "Helyettesítés",
            image: require("@/assets/images/react-logo.png"),
            description: "Jelentkez be és kapj értesítést a rád vonatkozó helyettsítésekről.",
        },
        {
            title: "IKSZ lehetőségek",
            image: require("@/assets/images/react-logo.png"),
            description: "Keresd meg a legjobb modját hogy össze gyüjtsd az 50 iksz órád!.",
        },
    ];
}