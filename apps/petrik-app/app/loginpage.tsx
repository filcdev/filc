import React from 'react';
import {View, Text} from 'react-native';
import BackGroundLinearGradient from "@/ui/core/background";

const loginPage = () => {
    return (
       <BackGroundLinearGradient>
           <View className="w-full h-full">
               <Text>Alma</Text>
           </View>
       </BackGroundLinearGradient>
    );
};

export default loginPage;