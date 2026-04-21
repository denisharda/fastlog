import { useState } from 'react';
import { View, Text, TextInput, TextInputProps, Pressable } from 'react-native';
import { Theme, hexAlpha } from '../../constants/theme';

interface FieldProps extends Omit<TextInputProps, 'style'> {
  theme: Theme;
  label: string;
  helper?: string;
  error?: string;
  trailing?: React.ReactNode;
  /** Controls autoFocus without an explicit native focus. */
  initiallyFocused?: boolean;
}

/**
 * Themed input with eyebrow label, focused primary ring glow, and helper/error row.
 * Matches Field from screens-auth.jsx spec.
 */
export function Field({
  theme,
  label,
  helper,
  error,
  trailing,
  secureTextEntry,
  initiallyFocused,
  ...rest
}: FieldProps) {
  const [focused, setFocused] = useState(!!initiallyFocused);
  const borderColor = error ? theme.danger : focused ? theme.primary : theme.hairline;

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
      <View style={{ position: 'relative' }}>
        {focused && !error && (
          <View
            style={{
              position: 'absolute',
              top: -4,
              left: -4,
              right: -4,
              bottom: -4,
              borderRadius: 20,
              backgroundColor: hexAlpha(theme.primary, 0x22),
            }}
          />
        )}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            height: 54,
            borderRadius: 16,
            paddingHorizontal: 16,
            backgroundColor: theme.surface,
            borderWidth: 1.5,
            borderColor,
          }}
        >
        <TextInput
          {...rest}
          secureTextEntry={secureTextEntry}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          placeholderTextColor={theme.textFaint}
          style={{
            flex: 1,
            fontSize: 16,
            fontWeight: '500',
            color: theme.text,
            letterSpacing: -0.2,
            paddingVertical: 0,
          }}
        />
        {trailing}
        </View>
      </View>
      {(error || helper) && (
        <Text
          style={{
            fontSize: 12,
            color: error ? theme.danger : theme.textMuted,
            marginTop: 6,
            paddingLeft: 4,
            letterSpacing: -0.1,
          }}
        >
          {error || helper}
        </Text>
      )}
    </View>
  );
}
