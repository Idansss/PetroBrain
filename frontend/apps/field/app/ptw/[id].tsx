import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { spacing } from '@petrobrain/ui/tokens';

import { Banner } from '../../src/components/Banner';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { SignaturePad } from '../../src/components/SignaturePad';
import { permitToHtml } from '../../src/lib/ptw/generate';
import {
  addSignature,
  getPermit,
  queuePermitForSync,
  savePermit,
} from '../../src/lib/ptw/repository';
import type { GeneratedPermit, SavedPermit } from '../../src/lib/ptw/types';
import { useSessionStore } from '../../src/lib/session/store';
import { useFieldTheme } from '../../src/lib/session/useColorMode';
import { scaleFontSize, type FieldTheme } from '../../src/theme/index';
import type { TextSize } from '../../src/lib/settings/preferences';

export default function PermitDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const theme = useFieldTheme();
  const principal = useSessionStore((s) => s.principal);
  const textSize = useSessionStore((s) => s.preferences.textSize);

  const [permit, setPermit] = useState<SavedPermit | null>(null);
  const [signing, setSigning] = useState<null | 'permit_issuer' | 'performing_authority'>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!principal || !id) return;
    const row = await getPermit(principal.tenantId, id);
    setPermit(row);
  }, [principal, id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!principal) {
    return (
      <ScreenContainer theme={theme} textSize={textSize}>
        <Banner tone="warn" title="Sign in required" theme={theme} textSize={textSize}>
          Sign in to view this permit.
        </Banner>
      </ScreenContainer>
    );
  }
  if (!permit) {
    return (
      <ScreenContainer theme={theme} textSize={textSize}>
        <Text style={{ color: theme.text, fontSize: scaleFontSize(14, textSize) }}>
          Loading permit…
        </Text>
      </ScreenContainer>
    );
  }

  async function onSavePermit(next: GeneratedPermit) {
    if (!principal || !permit) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await savePermit({
        id: permit.id,
        tenant_id: principal.tenantId,
        user_id: principal.userId,
        form: permit.form,
        generated: next,
      });
      setPermit(updated);
    } finally {
      setBusy(false);
    }
  }

  async function onSign(input: { name: string; signature_png_b64?: string }) {
    if (!signing || !permit) return;
    setBusy(true);
    setError(null);
    try {
      const sig: { role: string; name: string; signed_utc: string; signature_png_b64?: string } = {
        role: signing,
        name: input.name,
        signed_utc: new Date().toISOString(),
      };
      if (input.signature_png_b64) sig.signature_png_b64 = input.signature_png_b64;
      const updated = await addSignature(permit.tenant_id, permit.id, sig);
      setPermit(updated);
      setSigning(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onExportPdf() {
    if (!permit) return;
    setBusy(true);
    setError(null);
    try {
      const { uri } = await Print.printToFileAsync({ html: permitToHtml(permit.generated) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: permit.generated.permit_id,
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onQueueSync() {
    if (!permit) return;
    setBusy(true);
    setError(null);
    try {
      await queuePermitForSync(permit);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenContainer theme={theme} textSize={textSize}>
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <Text style={{ color: theme.primary, fontSize: scaleFontSize(15, textSize), fontWeight: '600' }}>
            ← Back
          </Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={[styles.heading, { color: theme.text, fontSize: scaleFontSize(20, textSize) }]}
        >
          {permit.generated.format === 'toolbox_talk' ? 'Toolbox talk' : 'Permit draft'}
        </Text>
      </View>

      <Banner tone="info" title="DECISION SUPPORT ONLY" theme={theme} textSize={textSize}>
        {permit.generated.banner}
      </Banner>

      <EditableField
        label="Job description"
        value={permit.generated.job_description}
        multiline
        onChange={(next) => onSavePermit({ ...permit.generated, job_description: next })}
        theme={theme}
        textSize={textSize}
        disabled={busy}
      />
      <EditableField
        label="Location"
        value={permit.generated.location}
        onChange={(next) => onSavePermit({ ...permit.generated, location: next })}
        theme={theme}
        textSize={textSize}
        disabled={busy}
      />

      <Section title="Hazards" theme={theme} textSize={textSize}>
        <Bullets items={permit.generated.hazards} theme={theme} textSize={textSize} />
      </Section>

      <Section title="Controls (merged)" theme={theme} textSize={textSize}>
        <Bullets items={permit.generated.controls.merged} theme={theme} textSize={textSize} />
      </Section>

      <Section title="Isolations" theme={theme} textSize={textSize}>
        <Bullets items={permit.generated.isolations} theme={theme} textSize={textSize} />
      </Section>

      <Section title="Required PPE (merged)" theme={theme} textSize={textSize}>
        <Bullets items={permit.generated.required_ppe.merged} theme={theme} textSize={textSize} />
      </Section>

      {permit.generated.briefing ? (
        <Section title="Briefing" theme={theme} textSize={textSize}>
          <Bullets items={permit.generated.briefing} theme={theme} textSize={textSize} />
        </Section>
      ) : null}

      <Section title="Sign-off" theme={theme} textSize={textSize}>
        <SignatureRow
          role="permit_issuer"
          label="Permit Issuer"
          signature={permit.signatures.find((s) => s.role === 'permit_issuer')}
          onStart={() => setSigning('permit_issuer')}
          theme={theme}
          textSize={textSize}
        />
        <SignatureRow
          role="performing_authority"
          label="Performing Authority"
          signature={permit.signatures.find((s) => s.role === 'performing_authority')}
          onStart={() => setSigning('performing_authority')}
          theme={theme}
          textSize={textSize}
        />
      </Section>

      {signing ? (
        <SignaturePad
          label={`Sign as ${signing === 'permit_issuer' ? 'Permit Issuer' : 'Performing Authority'}`}
          theme={theme}
          textSize={textSize}
          disabled={busy}
          onSign={onSign}
        />
      ) : null}

      {error ? (
        <Banner tone="danger" title="Action failed" theme={theme} textSize={textSize}>
          {error}
        </Banner>
      ) : null}

      <View style={styles.actions}>
        <PrimaryButton
          label="Export PDF"
          onPress={onExportPdf}
          disabled={busy}
          variant="secondary"
          theme={theme}
          textSize={textSize}
        />
        <PrimaryButton
          label="Queue for sync"
          onPress={onQueueSync}
          disabled={busy}
          variant="secondary"
          theme={theme}
          textSize={textSize}
        />
      </View>

      <Text
        style={{ color: theme.textMuted, fontSize: scaleFontSize(10, textSize), fontFamily: 'Courier' }}
      >
        Audit hash: {permit.generated.audit_sha256}
      </Text>
    </ScreenContainer>
  );
}

interface SectionProps {
  title: string;
  theme: FieldTheme;
  textSize: TextSize;
  children: React.ReactNode;
}
function Section({ title, theme, textSize, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text
        style={[
          styles.sectionTitle,
          { color: theme.textMuted, fontSize: scaleFontSize(11, textSize) },
        ]}
      >
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function Bullets({
  items,
  theme,
  textSize,
}: {
  items: string[];
  theme: FieldTheme;
  textSize: TextSize;
}) {
  if (items.length === 0) {
    return (
      <Text style={{ color: theme.textMuted, fontSize: scaleFontSize(13, textSize) }}>none</Text>
    );
  }
  return (
    <View style={{ gap: 2 }}>
      {items.map((item, i) => (
        <Text
          key={i}
          style={{ color: theme.text, fontSize: scaleFontSize(13, textSize) }}
        >
          • {item}
        </Text>
      ))}
    </View>
  );
}

interface SignatureRowProps {
  role: 'permit_issuer' | 'performing_authority';
  label: string;
  signature: SavedPermit['signatures'][number] | undefined;
  onStart: () => void;
  theme: FieldTheme;
  textSize: TextSize;
}
function SignatureRow({ label, signature, onStart, theme, textSize }: SignatureRowProps) {
  return (
    <View
      style={[
        styles.signatureRow,
        { borderColor: theme.border, backgroundColor: theme.surfaceMuted },
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: theme.text, fontWeight: '600', fontSize: scaleFontSize(13, textSize) }}>
          {label}
        </Text>
        {signature ? (
          <Text style={{ color: theme.textMuted, fontSize: scaleFontSize(11, textSize) }}>
            Signed by {signature.name} · {signature.signed_utc.slice(0, 16).replace('T', ' ')}
          </Text>
        ) : (
          <Text style={{ color: theme.textMuted, fontSize: scaleFontSize(11, textSize) }}>
            Unsigned
          </Text>
        )}
      </View>
      {!signature ? (
        <Pressable
          accessibilityRole="button"
          onPress={onStart}
          style={[styles.signBtn, { backgroundColor: theme.primary }]}
        >
          <Text style={{ color: theme.primaryFg, fontWeight: '700', fontSize: scaleFontSize(13, textSize) }}>
            Sign
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

interface EditableFieldProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  multiline?: boolean;
  theme: FieldTheme;
  textSize: TextSize;
  disabled?: boolean;
}
function EditableField({ label, value, onChange, multiline, theme, textSize, disabled }: EditableFieldProps) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);

  useEffect(() => setDraft(value), [value]);

  function commit() {
    if (draft.trim() !== value.trim() && draft.trim().length > 0) {
      onChange(draft.trim());
    }
    setEditing(false);
  }

  if (!editing) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => !disabled && setEditing(true)}
        style={[styles.editableView, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}
      >
        <Text style={{ color: theme.textMuted, fontSize: scaleFontSize(11, textSize), fontWeight: '600' }}>
          {label.toUpperCase()}
        </Text>
        <Text style={{ color: theme.text, fontSize: scaleFontSize(14, textSize) }}>{value}</Text>
        <Text style={{ color: theme.primary, fontSize: scaleFontSize(11, textSize) }}>tap to edit</Text>
      </Pressable>
    );
  }
  return (
    <View style={[styles.editableView, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
      <Text style={{ color: theme.textMuted, fontSize: scaleFontSize(11, textSize), fontWeight: '600' }}>
        {label.toUpperCase()}
      </Text>
      <TextInput
        autoFocus
        multiline={multiline}
        value={draft}
        onChangeText={setDraft}
        onBlur={commit}
        editable={!disabled}
        style={{
          color: theme.text,
          fontSize: scaleFontSize(14, textSize),
          minHeight: multiline ? 80 : spacing[14],
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 8,
          padding: spacing[2],
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  back: { paddingVertical: spacing[1], paddingRight: spacing[2] },
  heading: { fontWeight: '700' },
  section: { gap: spacing[1] },
  sectionTitle: { fontWeight: '600', letterSpacing: 0.5 },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing[3],
    minHeight: spacing[14],
  },
  signBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: 8,
  },
  actions: { gap: spacing[2] },
  editableView: {
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing[3],
    gap: spacing[1],
    minHeight: spacing[14],
  },
});
