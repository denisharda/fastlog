import { useMemo, useState } from 'react';
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
import { AmbientGlow, CircleIcon, Field, PrimaryButton, SocialButton } from '../../components/ui';
import Svg, { Path } from 'react-native-svg';
import { signInWithApple, signUpWithEmail } from '../../lib/auth';

function evaluateStrength(pw: string): { bars: number; label: string } {
  if (!pw) return { bars: 0, label: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ['Too short', 'Weak', 'Fair', 'Strong', 'Very strong'];
  return { bars: score, label: labels[score] };
}

export default function RegisterScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(true);
  const [loading, setLoading] = useState<'email' | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState(false);

  const strength = useMemo(() => evaluateStrength(password), [password]);

  async function handleRegister() {
    if (!name || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!agreed) {
      setError('Please agree to the terms to continue.');
      return;
    }
    setLoading('email');
    setError(null);
    try {
      await signUpWithEmail(email, password, name);
      setConfirmEmail(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign-up failed');
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

  if (confirmEmail) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <AmbientGlow
          color={theme.success}
          alpha={theme.isDark ? 0x44 : 0x33}
          width={420}
          height={320}
          top={-160}
        />
        <View
          style={{
            paddingTop: insets.top + 10,
            paddingHorizontal: 20,
            alignItems: 'center',
          }}
        >
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
        </View>
        <View style={{ paddingHorizontal: 24, paddingTop: 48 }}>
          <Text style={{ fontSize: 32, fontWeight: '700', color: theme.text, letterSpacing: -1, lineHeight: 36 }}>
            Check your email
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: theme.textMuted,
              marginTop: 12,
              lineHeight: 22,
              letterSpacing: -0.1,
            }}
          >
            We sent a confirmation link to{' '}
            <Text style={{ color: theme.text, fontWeight: '600' }}>{email}</Text>.
            Tap the link to activate your account.
          </Text>
          <View style={{ marginTop: 28 }}>
            <PrimaryButton theme={theme} onPress={() => router.replace('/(auth)/login')}>
              Back to Log In
            </PrimaryButton>
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: theme.bg }}
    >
      <AmbientGlow
        color={theme.accent}
        alpha={theme.isDark ? 0x44 : 0x33}
        width={360}
        height={300}
        top={-160}
        left={-100}
      />

      <View
        style={{
          paddingTop: insets.top + 10,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <CircleIcon
          theme={theme}
          size={36}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(auth)/login');
          }}
        >
          <Svg width={10} height={16} viewBox="0 0 10 16">
            <Path
              d="M8 2L2 8l6 6"
              stroke={theme.textMuted}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </CircleIcon>
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
          Create your account
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
          Starts free. Upgrade when you're ready — no pressure.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <Field
          theme={theme}
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          autoCapitalize="words"
          autoComplete="name"
        />
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
          placeholder="At least 8 characters"
          secureTextEntry={!showPassword}
          autoComplete="password-new"
          trailing={
            <Pressable onPress={() => setShowPassword(s => !s)} hitSlop={8}>
              <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '600' }}>
                {showPassword ? 'Hide' : 'Show'}
              </Text>
            </Pressable>
          }
        />

        {password.length > 0 && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginHorizontal: 4,
              marginTop: -4,
              marginBottom: 18,
            }}
          >
            <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
              {[0, 1, 2, 3].map(i => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: i < strength.bars ? theme.success : theme.hairline,
                  }}
                />
              ))}
            </View>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: strength.bars >= 3 ? theme.success : theme.textMuted,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              {strength.label}
            </Text>
          </View>
        )}

        {/* Consent */}
        <Pressable
          onPress={() => setAgreed(a => !a)}
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16, paddingHorizontal: 4 }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              backgroundColor: agreed ? theme.primary : 'transparent',
              borderWidth: agreed ? 0 : 1.5,
              borderColor: theme.hairline,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {agreed && (
              <Svg width={12} height={12} viewBox="0 0 12 12">
                <Path
                  d="M2 6l2.5 2.5L10 3"
                  stroke="#fff"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            )}
          </View>
          <Text
            style={{
              flex: 1,
              fontSize: 12,
              color: theme.textMuted,
              lineHeight: 18,
              letterSpacing: -0.1,
            }}
          >
            I agree to the <Text style={{ color: theme.primary, fontWeight: '600' }}>Terms</Text> and{' '}
            <Text style={{ color: theme.primary, fontWeight: '600' }}>Privacy Policy</Text>. Your data stays on
            your device by default.
          </Text>
        </Pressable>

        {error && (
          <Text style={{ color: theme.danger, fontSize: 13, textAlign: 'center', marginBottom: 10 }}>{error}</Text>
        )}

        <PrimaryButton theme={theme} onPress={handleRegister} loading={loading === 'email'}>
          Create account
        </PrimaryButton>

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
          {Platform.OS === 'ios' && (
            <SocialButton theme={theme} provider="apple" onPress={handleApple} loading={loading === 'apple'} />
          )}
          <SocialButton theme={theme} provider="google" onPress={() => setError('Google sign-in coming soon')} />
        </View>
      </ScrollView>

      <Pressable
        onPress={() => router.push('/(auth)/login')}
        style={{ paddingVertical: 12, alignItems: 'center', paddingBottom: insets.bottom + 16 }}
      >
        <Text style={{ fontSize: 14, color: theme.textMuted }}>
          Already have an account? <Text style={{ color: theme.primary, fontWeight: '600' }}>Log in</Text>
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}
