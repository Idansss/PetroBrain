import { useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { spacing } from '@petrobrain/ui/tokens';

import { PrimaryButton } from './PrimaryButton.js';
import type { TextSize } from '../lib/settings/preferences.js';
import { scaleFontSize, type FieldTheme } from '../theme/index.js';

export interface SignaturePadProps {
  label: string;
  theme: FieldTheme;
  textSize: TextSize;
  /** Called with the captured PNG base64 + the typed name. */
  onSign: (input: { name: string; signature_png_b64?: string }) => void;
  disabled?: boolean;
}

/**
 * Signature capture.
 *
 * On native we render react-native-signature-canvas inside a fixed-size
 * box and emit the resulting base64 PNG. On web (used during local dev
 * via expo-start --web) the canvas component isn't bundled here; we
 * fall back to a typed-name confirmation so the flow is exercisable end
 * to end. Either way the user must enter their name before saving.
 */
export function SignaturePad({ label, theme, textSize, onSign, disabled }: SignaturePadProps) {
  const [name, setName] = useState('');
  const signatureRef = useRef<{ readSignature: () => void } | null>(null);
  const [glyph, setGlyph] = useState<string | null>(null);

  const native = Platform.OS === 'ios' || Platform.OS === 'android';

  function commit() {
    if (!name.trim()) return;
    const payload: { name: string; signature_png_b64?: string } = { name: name.trim() };
    if (glyph) payload.signature_png_b64 = glyph;
    onSign(payload);
    setName('');
    setGlyph(null);
  }

  return (
    <View style={[styles.container, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <Text style={[styles.label, { color: theme.text, fontSize: scaleFontSize(13, textSize) }]}>
        {label}
      </Text>

      {native ? (
        <NativeSignatureCanvas onSigned={setGlyph} signatureRef={signatureRef} theme={theme} />
      ) : (
        <View
          style={[styles.webPad, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}
        >
          <Text style={{ color: theme.textMuted, fontSize: scaleFontSize(12, textSize) }}>
            Handwritten signature capture is available on iOS / Android only. The typed name below
            will be recorded with the timestamp.
          </Text>
        </View>
      )}

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Print your name"
        placeholderTextColor={theme.textMuted}
        editable={!disabled}
        style={[
          styles.nameInput,
          {
            color: theme.text,
            backgroundColor: theme.surfaceMuted,
            borderColor: theme.border,
            fontSize: scaleFontSize(14, textSize),
          },
        ]}
      />

      <PrimaryButton
        label="Confirm signature"
        onPress={commit}
        disabled={disabled || !name.trim()}
        theme={theme}
        textSize={textSize}
      />
    </View>
  );
}

interface NativeSignatureCanvasProps {
  onSigned: (base64Png: string | null) => void;
  signatureRef: React.MutableRefObject<{ readSignature: () => void } | null>;
  theme: FieldTheme;
}

/**
 * Loaded lazily so the web bundle (used by ``expo start --web``)
 * doesn't drag in react-native-webview, which only ships native binaries
 * for iOS / Android.
 */
function NativeSignatureCanvas({ onSigned, signatureRef, theme }: NativeSignatureCanvasProps) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Signature = require('react-native-signature-canvas').default as React.ComponentType<{
    onOK: (sig: string) => void;
    descriptionText?: string;
    webStyle?: string;
    style?: React.CSSProperties;
    ref?: React.Ref<{ readSignature: () => void }>;
  }>;
  return (
    <View style={styles.canvasBox}>
      <Signature
        ref={signatureRef}
        onOK={(sig) => onSigned(sig)}
        descriptionText=""
        webStyle={`.m-signature-pad--footer{display:none} body,html{background:${theme.surfaceMuted};}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing[3],
    gap: spacing[2],
  },
  label: { fontWeight: '600' },
  webPad: {
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing[3],
  },
  canvasBox: {
    height: 180,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  nameInput: {
    minHeight: spacing[14],
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing[3],
  },
});
