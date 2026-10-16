import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { radius, size, spacing, type, useTheme } from '@/theme';
import { Icon } from './icon';
import { Text } from './text';

// ------------------------------------------------------------------ TextField
type FieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  helper?: string;
  error?: string;
  prefix?: string;
  mono?: boolean;
};

/** A labelled single-line input with helper or error text. */
export function TextField({ label, helper, error, prefix, mono, ...input }: FieldProps) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  const message = error ?? helper;
  return (
    <View style={styles.field}>
      <Text variant="label" color="inkMuted" nativeID={`${label}-label`}>
        {label}
      </Text>
      <View
        style={[
          styles.box,
          {
            backgroundColor: c.card,
            borderColor: error ? c.dangerInk : focused ? c.accent : c.borderStrong,
          },
        ]}>
        {prefix ? <Text variant="figure" color="inkMuted">{prefix}</Text> : null}
        <TextInput
          {...input}
          accessibilityLabel={label}
          accessibilityHint={message}
          placeholderTextColor={c.inkMuted}
          onFocus={(e) => { setFocused(true); input.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); input.onBlur?.(e); }}
          style={[styles.input, mono ? type.figure : type.body, { color: c.ink }]}
        />
      </View>
      {message ? (
        <View style={styles.help}>
          {error ? <Icon name="alert" size={14} color="dangerInk" /> : null}
          <Text variant="bodySm" color={error ? 'dangerInk' : 'inkMuted'} style={{ flex: 1 }}>
            {message}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------------ OtpInput
type OtpProps = {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  length?: number;
  helper?: string;
  error?: string;
};

/** Six cells over one hidden input, so paste and SMS/email autofill work. */
export function OtpInput({ value, onChange, onComplete, length = 6, helper, error }: OtpProps) {
  const { c } = useTheme();
  const ref = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);

  const set = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, length);
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
  };

  return (
    <View style={{ gap: spacing[3] }}>
      <Pressable onPress={() => ref.current?.focus()} accessibilityLabel={`Verification code, ${length} digits`}>
        <View style={styles.cells}>
          {Array.from({ length }, (_, i) => {
            const active = focused && !error && i === Math.min(value.length, length - 1);
            return (
              <View
                key={i}
                style={[
                  styles.cell,
                  { backgroundColor: c.card, borderColor: error ? c.dangerInk : active ? c.accent : c.borderStrong },
                ]}>
                <Text variant="otp">{value[i] ?? ''}</Text>
              </View>
            );
          })}
        </View>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={set}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          inputMode="numeric"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={length}
          autoFocus
          caretHidden
          style={styles.hiddenInput}
        />
      </Pressable>
      {error || helper ? (
        <View style={styles.help}>
          {error ? <Icon name="alert" size={14} color="dangerInk" /> : null}
          <Text variant="bodySm" color={error ? 'dangerInk' : 'inkMuted'} style={{ flex: 1 }}>
            {error ?? helper}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: size.fieldHeight,
    paddingHorizontal: spacing[4],
    borderWidth: 1.5,
    borderRadius: radius.sm,
  },
  input: { flex: 1, minWidth: 0, paddingVertical: spacing[3] },
  help: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cells: { flexDirection: 'row', gap: spacing[2] },
  cell: {
    flex: 1,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: radius.sm,
  },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
