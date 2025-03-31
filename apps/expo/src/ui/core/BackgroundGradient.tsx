import React, {ReactNode} from 'react';

 

import {View, Text} from 'react-native';
 

import {LinearGradient} from "expo-linear-gradient";
 


 

const BackgroundGradient = ({children} : {children: ReactNode}) => {
 

    return (
 

        <View className="w-full h-full">
 

            <LinearGradient colors={['#076653', '#06231D']}>
 

                <View className="w-full h-full">
 

                    {children}
 

                </View>
 

            </LinearGradient>
 

        </View>
 

    )
 

};
 


 

export default BackgroundGradient;