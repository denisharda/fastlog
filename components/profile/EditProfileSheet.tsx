import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';
import { useUserStore } from '../../stores/userStore';
import { supabase } from '../../lib/supabase';
import { updatePassword } from '../../lib/auth';
import { Field, PrimaryButton } from '../ui';

const MIN_PASSWORD_LENGTH = 8;

export interface EditProfileSheetRef {
  present: () => void;
  dismiss: () => void;
}

export const EditProfileSheet = forwardRef<EditProfileSheetRef, object>(
  function EditProfileSheet(_, ref) {
    const theme = useTheme();
    const sheetRef = useRef<BottomSheetModal>(null);
    const profile = useUserStore(s => s.profile);
    const updateProfile = useUserStore(s => s.updateProfile);

    const [email, setEmail] = useState<string>('');
    const [name, setName] = useState(profile?.name ?? '');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const snapPoints = useMemo(() => ['60%', '85%'], []);

    useImperativeHandle(
      ref,
      () => ({
        present: () => {
          setName(profile?.name ?? '');
          setNewPassword('');
          setConfirmPassword('');
          setFormError(null);
          setSaving(false);
          supabase.auth.getUser().then(({ data }) => {
            setEmail(data.user?.email ?? '');
          });
          sheetRef.current?.present();
        },
        dismiss: () => sheetRef.current?.dismiss(),
      }),
      [profile?.name],
    );

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.45} />
      ),
      [],
    );

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
      sheetRef.current?.dismiss();
    }

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        backdropComponent={renderBackdrop}
        backgroundStyle={{
          backgroundColor: theme.bg,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
        }}
        handleIndicatorStyle={{ backgroundColor: theme.hairline, width: 40, height: 4 }}
      >
        <View className="flex-row items-center justify-between px-6 pt-2 pb-4">
          <Text className="text-xl font-bold" style={{ color: theme.text }}>
            Edit profile
          </Text>
          <Pressable
            onPress={() => sheetRef.current?.dismiss()}
            className="p-2"
            accessibilityRole="button"
            accessibilityLabel="Close edit profile"
          >
            <Text className="text-lg" style={{ color: theme.textMuted }}>Done</Text>
          </Pressable>
        </View>

        <BottomSheetScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
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
                marginBottom: 4,
                letterSpacing: -0.1,
              }}
            >
              {formError}
            </Text>
          ) : null}

          <View style={{ marginTop: 16 }}>
            <PrimaryButton
              theme={theme}
              onPress={handleSave}
              disabled={!canSave}
              loading={saving}
            >
              Save
            </PrimaryButton>
          </View>
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

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
