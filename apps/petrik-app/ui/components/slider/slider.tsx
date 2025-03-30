import React from 'react';
import {View, FlatList} from 'react-native';
import SliderItem from "@/ui/components/slider/slider_item";

const Slider = () => {
  return (
    <View>
        <FlatList data={[]} renderItem={({item, index}) => <SliderItem/> } />
    </View>
  );
};

export default Slider;