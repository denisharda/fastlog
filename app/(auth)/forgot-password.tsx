import { useEffect, useRef, useState } from 'react';
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
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../../hooks/useTheme';
import { AmbientGlow, CircleIcon, Field, PrimaryButton } from '../../components/ui';
import { hexAlpha } from '../../constants/theme';
import { requestPasswordOtp, verifyPasswordOtp, updatePassword } from '../../lib/auth';

const COOLDOWN_SEC = 42;

type Step = 'email' | 'code';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startCooldown() {
    setCooldown(COOLDOWN_SEC);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown(c => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  async function handleSendCode() {
    if (!email) {
      setError('Please enter your email.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await requestPasswordOtp(email);
      setStep('code');
      startCooldown();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setError(null);
    setLoading(true);
    try {
      await requestPasswordOtp(email);
      startCooldown();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (code.trim().length < 8) {
      setError('Enter the 8-digit code from your email.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await verifyPasswordOtp(email, code);
      await updatePassword(password);
      // Don't drop the user into protected tabs — the session from the OTP
      // flow may not be fully established yet. Send them back to log in
      // with their new password.
      router.replace('/(auth)/login');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not reset password');
    } finally {
      setLoading(false);
    }
  }

  const title = step === 'email' ? 'Reset your password' : 'Enter your code';
  const subtitle =
    step === 'email'
      ? "Enter the email you signed up with. We'll send an 8-digit code — it'll arrive in a minute or two."
      : `We sent an 8-digit code to ${email}. Enter it below with your new password.`;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: theme.bg }}
    >
      <AmbientGlow
        color={theme.phases[2]}
        alpha={theme.isDark ? 0x44 : 0x33}
        width={420}
        height={320}
        top={-160}
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
            if (step === 'code') {
              setStep('email');
              setError(null);
              setCode('');
              setPassword('');
              return;
            }
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
          {title}
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
          {subtitle}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', marginBottom: 18 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: hexAlpha(theme.primary, 0x22),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
              <Circle cx={12} cy={16} r={6} stroke={theme.primary} strokeWidth={2.2} />
              <Path
                d="M17 16h11M24 16v4M28 16v3"
                stroke={theme.primary}
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            </Svg>
          </View>
        </View>

        {step === 'email' ? (
          <>
            <Field
              theme={theme}
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              helper="We'll only use this to send your reset code."
              error={error ?? undefined}
            />

            <View style={{ marginTop: 8 }}>
              <PrimaryButton theme={theme} onPress={handleSendCode} loading={loading}>
                Send code
              </PrimaryButton>
            </View>
          </>
        ) : (
          <>
            <Field
              theme={theme}
              label="8-digit code"
              value={code}
              onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 8))}
              placeholder="12345678"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={8}
            />
            <Field
              theme={theme}
              label="New password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              secureTextEntry={!showPassword}
              autoComplete="password-new"
              textContentType="newPassword"
              error={error ?? undefined}
              trailing={
                <Pressable onPress={() => setShowPassword(s => !s)} hitSlop={8}>
                  <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '600', letterSpacing: -0.1 }}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </Pressable>
              }
            />

            <View style={{ marginTop: 8 }}>
              <PrimaryButton theme={theme} onPress={handleVerify} loading={loading}>
                Reset password
              </PrimaryButton>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 16 }}>
              {cooldown > 0 ? (
                <Text style={{ color: theme.textMuted, fontSize: 13, fontWeight: '600' }}>
                  Resend in 0:{cooldown.toString().padStart(2, '0')}
                </Text>
              ) : (
                <Pressable onPress={handleResend} hitSlop={6} disabled={loading}>
                  <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '600' }}>
                    Resend code
                  </Text>
                </Pressable>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Pressable
        onPress={() => router.replace('/(auth)/login')}
        style={{ paddingVertical: 12, alignItems: 'center', paddingBottom: insets.bottom + 16 }}
      >
        <Text style={{ fontSize: 14, color: theme.textMuted }}>
          Remembered it? <Text style={{ color: theme.primary, fontWeight: '600' }}>Back to log in</Text>
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}
