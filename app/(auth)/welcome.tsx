import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  signInWithApple,
  signInWithEmail,
  signUpWithEmail,
} from '../../lib/auth';

export default function WelcomeScreen() {
  const [showEmail, setShowEmail] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<'apple' | 'email' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState(false);

  async function handleApple() {
    setLoading('apple');
    setError(null);
    try {
      await signInWithApple();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Apple sign-in failed';
      // User cancelled — don't show error
      if (message.includes('canceled') || message.includes('cancelled')) return;
      setError(message);
    } finally {
      setLoading(null);
    }
  }

  async function handleEmail() {
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (isSignUp && !name) {
      setError('Please enter your name.');
      return;
    }
    if (isSignUp && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading('email');
    setError(null);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, name);
        setConfirmEmail(true);
        return;
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="flex-1 items-center justify-center px-6">
          {/* Logo */}
          <View className="mb-12 items-center">
            <View className="w-24 h-24 rounded-full bg-primary items-center justify-center mb-6">
              <Text className="text-4xl">&#x23F1;</Text>
            </View>
            <Text className="text-4xl font-bold text-text-primary mb-2">FastAI</Text>
            <Text className="text-text-muted text-center text-base">
              Intermittent fasting with{'\n'}AI-powered check-ins
            </Text>
          </View>

          {/* Error */}
          {error ? (
            <View className="w-full mb-4">
              <Text className="text-red-400 text-sm text-center">{error}</Text>
            </View>
          ) : null}

          {confirmEmail ? (
            /* Email confirmation message */
            <View className="w-full items-center gap-4">
              <View className="w-16 h-16 rounded-full bg-primary items-center justify-center">
                <Text className="text-3xl">&#x2709;</Text>
              </View>
              <Text className="text-text-primary font-bold text-xl text-center">
                Check your email
              </Text>
              <Text className="text-text-muted text-center text-base leading-6">
                We sent a confirmation link to{'\n'}
                <Text className="text-text-primary font-medium">{email}</Text>
                {'\n'}Tap the link to activate your account.
              </Text>
              <Pressable
                className="mt-4 w-full border border-surface py-4 rounded-2xl items-center"
                onPress={() => {
                  setConfirmEmail(false);
                  setIsSignUp(false);
                  setError(null);
                }}
              >
                <Text className="text-text-muted font-semibold text-lg">
                  Back to Sign In
                </Text>
              </Pressable>
            </View>
          ) : !showEmail ? (
            /* Social + Email buttons */
            <View className="w-full gap-3">
              {/* Apple */}
              {Platform.OS === 'ios' && (
                <Pressable
                  className="w-full bg-white py-4 rounded-2xl items-center flex-row justify-center gap-2"
                  onPress={handleApple}
                  disabled={loading !== null}
                >
                  {loading === 'apple' ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <>
                      <Text className="text-black text-lg">{'\uF8FF'}</Text>
                      <Text className="text-black font-semibold text-lg">
                        Sign in with Apple
                      </Text>
                    </>
                  )}
                </Pressable>
              )}

              {/* Divider */}
              <View className="flex-row items-center my-1">
                <View className="flex-1 h-px bg-surface" />
                <Text className="text-text-muted mx-4 text-sm">or</Text>
                <View className="flex-1 h-px bg-surface" />
              </View>

              {/* Email */}
              <Pressable
                className="w-full border border-surface py-4 rounded-2xl items-center"
                onPress={() => setShowEmail(true)}
                disabled={loading !== null}
              >
                <Text className="text-text-muted font-semibold text-lg">
                  Continue with Email
                </Text>
              </Pressable>
            </View>
          ) : (
            /* Email form */
            <View className="w-full gap-3">
              {isSignUp && (
                <TextInput
                  className="bg-surface text-text-primary rounded-xl px-4 py-4"
                  placeholder="Your name"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                  value={name}
                  onChangeText={setName}
                />
              )}
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
                placeholder={isSignUp ? 'Password (min 8 characters)' : 'Password'}
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              <Pressable
                className="bg-primary py-4 rounded-2xl items-center"
                onPress={handleEmail}
                disabled={loading !== null}
              >
                {loading === 'email' ? (
                  <ActivityIndicator color="#F5F5F5" />
                ) : (
                  <Text className="text-text-primary font-semibold text-lg">
                    {isSignUp ? 'Create Account' : 'Sign In'}
                  </Text>
                )}
              </Pressable>

              <Pressable
                className="items-center mt-1"
                onPress={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                }}
              >
                <Text className="text-text-muted">
                  {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                  <Text className="text-accent">{isSignUp ? 'Sign In' : 'Sign Up'}</Text>
                </Text>
              </Pressable>

              <Pressable
                className="items-center"
                onPress={() => {
                  setShowEmail(false);
                  setError(null);
                }}
              >
                <Text className="text-text-muted text-sm">Back to other options</Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
