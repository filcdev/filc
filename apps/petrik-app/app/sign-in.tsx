import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useSession } from '../utils/auth_context';
import { useRouter } from 'expo-router';
import BackGroundLinearGradient from '@/ui/core/background';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, session } = useSession();
  const router = useRouter();

  if (session) {
    router.replace('/(auth)');
    return null;
  }

  return (
    <BackGroundLinearGradient>
      <View className="flex-1 items-center justify-center p-4">
        <Text className="mb-8 text-2xl font-bold text-white">Login</Text>
        
        <View className="w-full space-y-4">
          <TextInput
            className="w-full rounded-lg bg-white/10 p-4 text-white"
            placeholder="Email"
            placeholderTextColor="#ffffff80"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          
          <TextInput
            className="w-full rounded-lg bg-white/10 p-4 text-white"
            placeholder="Password"
            placeholderTextColor="#ffffff80"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          
          <TouchableOpacity
            className="w-full rounded-lg bg-primary p-4"
            onPress={() => {
              signIn();
              router.replace('/(auth)');
            }}
          >
            <Text className="text-center font-semibold text-black">Login</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
          >
            <Text className="text-center text-white">Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BackGroundLinearGradient>
  );
}