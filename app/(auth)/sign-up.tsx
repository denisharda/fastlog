import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

export default function SignUpScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignUp() {
    if (!name || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name } },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // Create profile record
      await supabase.from('profiles').upsert({
        id: data.user.id,
        name,
      });

      router.replace('/onboarding/protocol');
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
          <Text className="text-3xl font-bold text-text-primary mb-2">Create account</Text>
          <Text className="text-text-muted mb-8">Start your fasting journey</Text>

          <View className="gap-3 mb-4">
            <TextInput
              className="bg-surface text-text-primary rounded-xl px-4 py-4"
              placeholder="Your name"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
              value={name}
              onChangeText={setName}
            />
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
              placeholder="Password (min 8 characters)"
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
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#F5F5F5" />
            ) : (
              <Text className="text-text-primary font-semibold text-lg">Create Account</Text>
            )}
          </Pressable>

          <Pressable
            className="mt-4 items-center"
            onPress={() => router.back()}
          >
            <Text className="text-text-muted">
              Already have an account?{' '}
              <Text className="text-accent">Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
