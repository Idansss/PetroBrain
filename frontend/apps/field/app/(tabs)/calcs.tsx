import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { spacing } from '@petrobrain/ui/tokens';

import { Banner } from '../../src/components/Banner';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { fetchCalcCatalog } from '../../src/lib/calc/api';
import {
  familyLabel,
  groupByFamily,
  sortedFamilies,
} from '../../src/lib/calc/request';
import { listRecentCalcs } from '../../src/lib/calc/repository';
import type { CalcCatalogEntry, RecentCalc } from '../../src/lib/calc/types';
import { useNetwork } from '../../src/lib/network/useNetwork';
import { useSessionStore } from '../../src/lib/session/store';
import { useFieldTheme } from '../../src/lib/session/useColorMode';
import { scaleFontSize, type FieldTheme } from '../../src/theme/index';
import type { TextSize } from '../../src/lib/settings/preferences';

/**
 * Calcs tab: Catalog (grouped by family, loaded from /calc/catalog) and
 * Recent (last ≤50 results from SQLite, viewable offline).
 */
type ViewMode = 'catalog' | 'recent';

export default function CalcsScreen() {
  const theme = useFieldTheme();
  const session = useSessionStore();
  const network = useNetwork();
  const textSize = session.preferences.textSize;

  const [view, setView] = useState<ViewMode>('catalog');
  const [catalog, setCatalog] = useState<CalcCatalogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentCalc[]>([]);

  const loadCatalog = useCallback(async () => {
    if (!session.token || !network.online) return;
    setError(null);
    try {
      const entries = await fetchCalcCatalog({ baseUrl: session.apiBaseUrl, token: session.token });
      setCatalog(entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [session.apiBaseUrl, session.token, network.online]);

  const loadRecent = useCallback(async () => {
    if (!session.principal) return;
    setRecent(await listRecentCalcs(session.principal.tenantId));
  }, [session.principal]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);
  useEffect(() => {
    void loadRecent();
  }, [loadRecent, view]);

  const grouped = useMemo(() => (catalog ? groupByFamily(catalog) : {}), [catalog]);
  const families = useMemo(() => sortedFamilies(grouped), [grouped]);

  return (
    <ScreenContainer theme={theme} textSize={textSize}>
      <Text
        accessibilityRole="header"
        style={[styles.heading, { color: theme.text, fontSize: scaleFontSize(22, textSize) }]}
      >
        Calcs
      </Text>

      <Segmented view={view} onChange={setView} theme={theme} textSize={textSize} />

      {view === 'catalog' ? (
        <CatalogView
          catalog={catalog}
          grouped={grouped}
          families={families}
          isLoading={catalog === null && network.online}
          isOffline={!network.online && catalog === null}
          error={error}
          theme={theme}
          textSize={textSize}
        />
      ) : (
        <RecentView recent={recent} theme={theme} textSize={textSize} />
      )}
    </ScreenContainer>
  );
}

interface CatalogViewProps {
  catalog: CalcCatalogEntry[] | null;
  grouped: Record<string, CalcCatalogEntry[]>;
  families: string[];
  isLoading: boolean;
  isOffline: boolean;
  error: string | null;
  theme: FieldTheme;
  textSize: TextSize;
}

function CatalogView({ catalog, grouped, families, isLoading, isOffline, error, theme, textSize }: CatalogViewProps) {
  if (isOffline) {
    return (
      <Banner tone="warn" title="Offline" theme={theme} textSize={textSize}>
        The catalog loads from the backend. Reconnect to browse calcs; you can still review past
        results on the Recent tab.
      </Banner>
    );
  }
  if (error) {
    return (
      <Banner tone="danger" title="Could not load catalog" theme={theme} textSize={textSize}>
        {error}
      </Banner>
    );
  }
  if (isLoading || !catalog) {
    return (
      <Text style={{ color: theme.textMuted, fontSize: scaleFontSize(13, textSize) }}>
        Loading catalog…
      </Text>
    );
  }
  return (
    <View style={{ gap: spacing[3] }}>
      <Banner tone="info" title="Numbers come from the backend" theme={theme} textSize={textSize}>
        Every calc is executed server-side and returned with formula, inputs, steps, and result.
        Safety-critical calcs (kill mud weight, MAASP) carry the verification banner.
      </Banner>
      {families.map((family) => (
        <View key={family} style={{ gap: spacing[1] }}>
          <Text
            style={{
              color: theme.textMuted,
              fontSize: scaleFontSize(11, textSize),
              fontWeight: '600',
              letterSpacing: 0.5,
            }}
          >
            {familyLabel(family).toUpperCase()}
          </Text>
          {grouped[family]?.map((entry) => (
            <Pressable
              key={entry.name}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/calcs/[name]', params: { name: entry.name } })}
              style={[styles.row, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{ color: theme.text, fontWeight: '600', fontSize: scaleFontSize(15, textSize) }}
                >
                  {entry.label}
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: scaleFontSize(12, textSize) }}>
                  {entry.summary}
                </Text>
              </View>
              {entry.safety_critical ? (
                <View
                  style={{
                    backgroundColor: theme.banner.warn,
                    borderColor: theme.bannerFg.warn,
                    borderWidth: 1,
                    paddingHorizontal: spacing[2],
                    paddingVertical: 4,
                    borderRadius: 999,
                  }}
                >
                  <Text
                    style={{
                      color: theme.bannerFg.warn,
                      fontWeight: '700',
                      fontSize: scaleFontSize(10, textSize),
                    }}
                  >
                    safety
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

function RecentView({
  recent,
  theme,
  textSize,
}: {
  recent: RecentCalc[];
  theme: FieldTheme;
  textSize: TextSize;
}) {
  if (recent.length === 0) {
    return (
      <Text style={{ color: theme.textMuted, fontSize: scaleFontSize(14, textSize) }}>
        No recent calcs yet. Run one from the catalog tab.
      </Text>
    );
  }
  return (
    <View style={{ gap: spacing[2] }}>
      {recent.map((row) => (
        <Pressable
          key={row.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/calcs/recent/[id]', params: { id: row.id } })}
          style={[styles.row, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={{ color: theme.text, fontWeight: '600', fontSize: scaleFontSize(15, textSize) }}
            >
              {row.result.name}
            </Text>
            <Text style={{ color: theme.textMuted, fontSize: scaleFontSize(12, textSize) }}>
              {row.result.result.toLocaleString(undefined, { maximumFractionDigits: 4 })} {row.result.unit}
            </Text>
            <Text style={{ color: theme.textMuted, fontSize: scaleFontSize(11, textSize) }}>
              {row.created_utc.slice(0, 16).replace('T', ' ')} · {row.calc_name}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

interface SegmentedProps {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
  theme: FieldTheme;
  textSize: TextSize;
}
function Segmented({ view, onChange, theme, textSize }: SegmentedProps) {
  const tabs: Array<{ id: ViewMode; label: string }> = [
    { id: 'catalog', label: 'Catalog' },
    { id: 'recent', label: 'Recent' },
  ];
  return (
    <View style={[styles.segmented, { borderColor: theme.border }]}>
      {tabs.map((tab) => {
        const active = view === tab.id;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(tab.id)}
            style={[
              styles.segment,
              {
                backgroundColor: active ? theme.primary : theme.surface,
                borderRightColor: theme.border,
              },
            ]}
          >
            <Text
              style={{
                color: active ? theme.primaryFg : theme.text,
                fontWeight: '600',
                fontSize: scaleFontSize(13, textSize),
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontWeight: '700' },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2],
    minHeight: spacing[14],
    borderRightWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing[3],
    minHeight: spacing[14],
  },
});
