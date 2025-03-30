import React from 'react';
import { View, Text } from 'react-native';
import {SliderElementType} from "@/ui/components/slider/types/slider_types";

const SliderItem = (props: SliderElementType) => {
  return (
    <View>
      <Text>{props.item.title}</Text>
    </View>
  );
};

export default SliderItem;