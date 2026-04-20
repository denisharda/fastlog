import { useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../hooks/useTheme';
import { useUserStore } from '../stores/userStore';
import { supabase } from '../lib/supabase';
import { updatePassword } from '../lib/auth';
import { Field, PrimaryButton, CircleIcon } from '../components/ui';

const MIN_PASSWORD_LENGTH = 8;

export default function EditProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const profile = useUserStore(s => s.profile);
  const updateProfile = useUserStore(s => s.updateProfile);

  const [email, setEmail] = useState<string>('');
  const [name, setName] = useState(profile?.name ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? '');
    });
  }, []);

  const trimmedName = name.trim();
  const nameDirty = trimmedName !== (profile?.name ?? '');
  const wantsPwChange = newPassword.length > 0 || confirmPassword.length > 0;

  const pwError = (() => {
    if (!wantsPwChange) return undefined;
    if (newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH) {
      return `At least ${MIN_PASSWORD_LENGTH} characters`;
    }
    if (confirmPassword.length > 0 && newPassword !== confirmPassword) {
      return "Passwords don't match";
    }
    return undefined;
  })();

  const pwValid =
    !wantsPwChange || (newPassword.length >= MIN_PASSWORD_LENGTH && newPassword === confirmPassword);

  const canSave =
    !saving && trimmedName.length > 0 && (nameDirty || wantsPwChange) && pwValid;

  async function handleSave() {
    if (!profile || !canSave) return;
    setSaving(true);
    setFormError(null);

    if (nameDirty) {
      const prevName = profile.name;
      updateProfile({ name: trimmedName });
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ name: trimmedName })
        .eq('id', profile.id);

      if (dbError) {
        updateProfile({ name: prevName });
        setFormError('Could not save name. Please try again.');
        setSaving(false);
        return;
      }
    }

    if (wantsPwChange) {
      try {
        await updatePassword(newPassword);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not update password.';
        setFormError(message);
        setSaving(false);
        return;
      }
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaving(false);
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingHorizontal: 16,
          paddingBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <CircleIcon theme={theme} size={36} onPress={() => router.back()}>
          <Svg width={11} height={11} viewBox="0 0 11 11">
            <Path d="M1 1l9 9M10 1l-9 9" stroke={theme.textMuted} strokeWidth={1.8} strokeLinecap="round" />
          </Svg>
        </CircleIcon>
        <Text style={{ fontSize: 17, fontWeight: '600', color: theme.text, letterSpacing: -0.3 }}>
          Edit profile
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ReadOnlyRow theme={theme} label="Email" value={email || '—'} />

          <Field
            theme={theme}
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
            maxLength={60}
          />

          <Field
            theme={theme}
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="At least 8 characters"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            textContentType="newPassword"
            returnKeyType="next"
          />

          <Field
            theme={theme}
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repeat new password"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={handleSave}
            error={pwError}
          />

          {formError ? (
            <Text
              style={{
                fontSize: 13,
                color: theme.danger,
                marginTop: 4,
                letterSpacing: -0.1,
              }}
            >
              {formError}
            </Text>
          ) : null}
        </ScrollView>

        <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}>
          <PrimaryButton
            theme={theme}
            onPress={handleSave}
            disabled={!canSave}
            loading={saving}
          >
            Save
          </PrimaryButton>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function ReadOnlyRow({
  theme,
  label,
  value,
}: {
  theme: ReturnType<typeof useTheme>;
  label: string;
  value: string;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          color: theme.textFaint,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          height: 54,
          borderRadius: 16,
          paddingHorizontal: 16,
          backgroundColor: theme.surface2,
          borderWidth: 1.5,
          borderColor: theme.hairline,
          justifyContent: 'center',
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            fontSize: 16,
            fontWeight: '500',
            color: theme.textMuted,
            letterSpacing: -0.2,
          }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

