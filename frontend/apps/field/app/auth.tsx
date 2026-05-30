import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { spacing } from '@petrobrain/ui/tokens';

import { Banner } from '../src/components/Banner';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { decodePrincipal } from '../src/lib/session/jwt';
import { useSessionStore } from '../src/lib/session/store';
import { useFieldTheme } from '../src/lib/session/useColorMode';
import { scaleFontSize } from '../src/theme/index';

/**
 * Dev sign-in. The field app pastes a JWT minted against the same
 * ``PB_JWT_SECRET`` as the backend. Real SSO + device enrolment is a
 * later platform task (C2).
 */
export default function Auth() {
  const theme = useFieldTheme();
  const textSize = useSessionStore((s) => s.preferences.textSize);
  const setToken = useSessionStore((s) => s.setToken);

  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmed = value.trim();
    const principal = decodePrincipal(trimmed);
    if (!principal) {
      setError('Token is not a valid PetroBrain JWT.');
      return;
    }
    setError(null);
    await setToken(trimmed);
    router.replace('/(tabs)/ask');
  }

  return (
    <ScreenContainer theme={theme} textSize={textSize}>
      <Text
        accessibilityRole="header"
        style={[
          styles.heading,
          { color: theme.text, fontSize: scaleFontSize(24, textSize) },
        ]}
      >
        Sign in
      </Text>
      <Text style={[styles.muted, { color: theme.textMuted, fontSize: scaleFontSize(14, textSize) }]}>
        Paste a JWT minted with your backend&apos;s PB_JWT_SECRET.
      </Text>

      <Banner tone="info" title="Dev sign-in" theme={theme} textSize={textSize}>
        SSO + device enrolment lands later. Tokens live in the device Keychain / Keystore.
      </Banner>

      <View style={styles.field}>
        <Text style={[styles.label, { color: theme.text, fontSize: scaleFontSize(14, textSize) }]}>
          JWT
        </Text>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="eyJhbGciOi..."
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          numberOfLines={4}
          style={[
            styles.input,
            {
              color: theme.text,
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
              fontSize: scaleFontSize(14, textSize),
            },
          ]}
        />
        {error ? (
          <Text accessibilityRole="alert" style={[styles.error, { fontSize: scaleFontSize(13, textSize) }]}>
            {error}
          </Text>
        ) : null}
      </View>

      <PrimaryButton
        label="Continue"
        onPress={submit}
        textSize={textSize}
        theme={theme}
        accessibilityHint="Decode the JWT and open the field tabs."
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: { fontWeight: '700' },
  muted: { marginBottom: spacing[2] },
  field: { gap: spacing[1] },
  label: { fontWeight: '600' },
  input: {
    minHeight: spacing[14],
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing[3],
    textAlignVertical: 'top',
    fontFamily: 'Courier',
  },
  error: { color: '#b8262a', fontWeight: '600' },
});
