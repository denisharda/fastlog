import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
    } else {
      router.replace('/(tabs)');
    }

    setLoading(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="flex-1 px-6 justify-center">
          <Text className="text-3xl font-bold text-text-primary mb-2">Welcome back</Text>
          <Text className="text-text-muted mb-8">Sign in to your account</Text>

          <View className="gap-3 mb-4">
            <TextInput
              className="bg-surface text-text-primary rounded-xl px-4 py-4"
              placeholder="Email"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              className="bg-surface text-text-primary rounded-xl px-4 py-4"
              placeholder="Password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {error ? (
            <Text className="text-red-400 mb-4 text-sm">{error}</Text>
          ) : null}

          <Pressable
            className="bg-primary py-4 rounded-2xl items-center"
            onPress={handleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#F5F5F5" />
            ) : (
              <Text className="text-text-primary font-semibold text-lg">Sign In</Text>
            )}
          </Pressable>

          <Pressable
            className="mt-4 items-center"
            onPress={() => router.push('/(auth)/sign-up')}
          >
            <Text className="text-text-muted">
              Don't have an account?{' '}
              <Text className="text-accent">Sign up</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
