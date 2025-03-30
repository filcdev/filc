import {ImageSourcePropType} from "react-native";

export type SliderItemType = {
    title: string;
    image: ImageSourcePropType;
    description: string;
};

export type SliderElementType = {
    index: number;
    item: SliderItemType;
};