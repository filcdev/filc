import React from 'react';
import {View, FlatList} from 'react-native';
import SliderItem from "@/ui/components/slider/slider_item";
import {SliderData} from "@/ui/components/slider/data/slider_list";

const Slider = () => {
  return (
    <View>
        <FlatList data={SliderData.list} renderItem={({item, index}) => <SliderItem key={index} index={index} item={item} /> } />
    </View>
  );
};

export default Slider;