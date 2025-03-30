import React, {ReactNode} from 'react';
import {View} from 'react-native';
import {LinearGradient} from "expo-linear-gradient";

const BackGroundLinearGradient = ({children} : {children: ReactNode}) => {
    return (
        <View className="flex-1">
            <LinearGradient 
                colors={['#076653', '#06231D']} 
                className="flex-1"
            >
                <View className="flex-1">
                    {children}
                </View>
            </LinearGradient>
        </View>
    )
};

export default BackGroundLinearGradient;