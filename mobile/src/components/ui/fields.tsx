import { useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

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

/** A filled pill with its label above; focus draws a cobalt ring, an error turns the fill coral. */
export function TextField({ label, helper, error, prefix, mono, ...input }: FieldProps) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  const message = error ?? helper;
  return (
    <View style={styles.field}>
      <Text variant="label" nativeID={`${label}-label`} style={styles.label}>
        {label}
      </Text>
      <View
        style={[
          styles.box,
          {
            backgroundColor: error ? c.coral : focused ? c.ground : c.soft,
            borderColor: error ? c.coralInk : focused ? c.cobalt : 'transparent',
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
          style={[styles.input, mono ? type.figure : styles.inputText, { color: c.ink }]}
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

/** Six rounded cells over one hidden input, so paste and SMS/email autofill work. */
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
            const filled = i < value.length;
            const active = focused && !error && !filled && i === value.length;
            const bg = error ? c.coral : filled ? c.inkBlock : active ? c.cobaltTint : c.soft;
            return (
              <View key={i} style={[styles.cell, { backgroundColor: bg, borderColor: active ? c.cobalt : 'transparent' }]}>
                <Text variant="otp" style={{ color: filled && !error ? '#FFFFFF' : c.ink }}>
                  {value[i] ?? ''}
                </Text>
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
  label: { paddingLeft: 6 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: size.fieldHeight,
    paddingHorizontal: 20,
    borderWidth: 3,
    borderRadius: radius.pill,
  },
  // The pill draws the focus ring; drop the browser's own outline on web.
  input: { flex: 1, minWidth: 0, paddingVertical: spacing[3], ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : null) },
  inputText: { ...type.body, fontFamily: 'Figtree_600SemiBold', fontSize: 17 },
  help: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6 },
  cells: { flexDirection: 'row', gap: spacing[2] },
  cell: {
    flex: 1,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderRadius: radius.sm,
  },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
