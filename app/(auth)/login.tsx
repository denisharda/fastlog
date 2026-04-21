import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { AmbientGlow, Field, PrimaryButton, SocialButton } from '../../components/ui';
import { signInWithApple, signInWithEmail } from '../../lib/auth';

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState<'email' | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setLoading('email');
    setError(null);
    try {
      await signInWithEmail(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(null);
    }
  }

  async function handleApple() {
    setLoading('apple');
    setError(null);
    try {
      await signInWithApple();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Apple sign-in failed';
      if (!msg.toLowerCase().includes('cancel')) setError(msg);
    } finally {
      setLoading(null);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: theme.bg }}
    >
      <AmbientGlow
        color={theme.primary}
        alpha={theme.isDark ? 0x44 : 0x33}
        width={360}
        height={300}
        top={-160}
        left={40}
      />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ width: 36 }} />
        <Text
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: theme.primary,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          FastLog
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 8 }}>
        <Text style={{ fontSize: 32, fontWeight: '700', color: theme.text, letterSpacing: -1, lineHeight: 36 }}>
          Welcome back
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: theme.textMuted,
            marginTop: 10,
            letterSpacing: -0.1,
            lineHeight: 22,
          }}
        >
          Pick up where you left off — your rhythm is waiting.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <Field
          theme={theme}
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <Field
          theme={theme}
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry={!showPassword}
          autoComplete="password"
          trailing={
            <Pressable onPress={() => setShowPassword(s => !s)} hitSlop={8}>
              <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '600', letterSpacing: -0.1 }}>
                {showPassword ? 'Hide' : 'Show'}
              </Text>
            </Pressable>
          }
        />

        <Pressable
          onPress={() => router.push('/(auth)/forgot-password')}
          style={{ alignSelf: 'flex-end', marginTop: -4, marginBottom: 18 }}
          hitSlop={6}
        >
          <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '600', letterSpacing: -0.1 }}>
            Forgot password?
          </Text>
        </Pressable>

        {error && (
          <Text style={{ color: theme.danger, fontSize: 13, textAlign: 'center', marginBottom: 10 }}>{error}</Text>
        )}

        <PrimaryButton theme={theme} onPress={handleLogin} loading={loading === 'email'}>
          Log in
        </PrimaryButton>

        {/* Divider */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 }}>
          <View style={{ flex: 1, height: 0.5, backgroundColor: theme.hairline }} />
          <Text
            style={{
              fontSize: 11,
              fontWeight: '600',
              color: theme.textFaint,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            or
          </Text>
          <View style={{ flex: 1, height: 0.5, backgroundColor: theme.hairline }} />
        </View>

        <View style={{ gap: 10 }}>
          {Platform.OS === 'ios' && <SocialButton theme={theme} provider="apple" onPress={handleApple} loading={loading === 'apple'} />}
          <SocialButton theme={theme} provider="google" onPress={() => setError('Google sign-in coming soon')} />
        </View>
      </ScrollView>

      <Pressable
        onPress={() => router.push('/(auth)/register')}
        style={{ paddingVertical: 12, alignItems: 'center', paddingBottom: insets.bottom + 16 }}
      >
        <Text style={{ fontSize: 14, color: theme.textMuted }}>
          New to FastLog?{' '}
          <Text style={{ color: theme.primary, fontWeight: '600' }}>Create an account</Text>
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}
