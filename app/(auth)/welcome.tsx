import { useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
    <LinearGradient
      colors={['#1A1A1A', '#2D6A4F']}
      style={{ flex: 1 }}
    >
      <SafeAreaView className="flex-1">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View className="flex-1 items-center justify-center px-6">
            {/* Logo */}
            <View className="mb-12 items-center">
              <View
                className="w-24 h-24 rounded-[22px] mb-6 items-center justify-center"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <Image
                  source={require('../../assets/icon.png')}
                  className="w-20 h-20 rounded-2xl"
                />
              </View>
              <Text className="text-3xl font-bold text-white mb-2">FastLog</Text>
              <Text className="text-center text-base" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Intermittent fasting{'\n'}made simple
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
                <View className="w-16 h-16 rounded-full items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                  <Text className="text-3xl">&#x2709;</Text>
                </View>
                <Text className="text-white font-bold text-xl text-center">
                  Check your email
                </Text>
                <Text className="text-center text-base leading-6" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  We sent a confirmation link to{'\n'}
                  <Text className="text-white font-medium">{email}</Text>
                  {'\n'}Tap the link to activate your account.
                </Text>
                <Pressable
                  className="mt-4 w-full py-4 rounded-2xl items-center"
                  style={{ borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)' }}
                  onPress={() => {
                    setConfirmEmail(false);
                    setIsSignUp(false);
                    setError(null);
                  }}
                >
                  <Text className="text-white font-semibold text-lg">
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
                      <ActivityIndicator color="#1A1A1A" />
                    ) : (
                      <>
                        <Text className="text-text-primary text-lg">{'\uF8FF'}</Text>
                        <Text className="text-text-primary font-semibold text-lg">
                          Sign in with Apple
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}

                {/* Divider */}
                <View className="flex-row items-center my-1">
                  <View className="flex-1 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
                  <Text className="mx-4 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>or</Text>
                  <View className="flex-1 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
                </View>

                {/* Email */}
                <Pressable
                  className="w-full py-4 rounded-2xl items-center"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)' }}
                  onPress={() => setShowEmail(true)}
                  disabled={loading !== null}
                >
                  <Text className="text-white font-semibold text-lg">
                    Continue with Email
                  </Text>
                </Pressable>
              </View>
            ) : (
              /* Email form */
              <View className="w-full gap-3">
                {isSignUp && (
                  <TextInput
                    className="rounded-xl px-4 h-14 text-[16px] text-white"
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}
                    placeholder="Your name"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    autoCapitalize="words"
                    value={name}
                    onChangeText={setName}
                  />
                )}
                <TextInput
                  className="rounded-xl px-4 h-14 text-[16px] text-white"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}
                  placeholder="Email"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
                <TextInput
                  className="rounded-xl px-4 h-14 text-[16px] text-white"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}
                  placeholder={isSignUp ? 'Password (min 8 characters)' : 'Password'}
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />

                <Pressable
                  className="bg-white py-4 rounded-2xl items-center"
                  onPress={handleEmail}
                  disabled={loading !== null}
                >
                  {loading === 'email' ? (
                    <ActivityIndicator color="#1A1A1A" />
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
                  <Text style={{ color: 'rgba(255,255,255,0.6)' }}>
                    {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                    <Text className="text-white font-medium">{isSignUp ? 'Sign In' : 'Sign Up'}</Text>
                  </Text>
                </Pressable>

                <Pressable
                  className="items-center"
                  onPress={() => {
                    setShowEmail(false);
                    setError(null);
                  }}
                >
                  <Text className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Back to other options</Text>
                </Pressable>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </SafeAreaView>
    </LinearGradient>
  );
}
