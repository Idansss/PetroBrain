import { StyleSheet, Text, View } from 'react-native';

import { spacing } from '@petrobrain/ui/tokens';

import { scaleFontSize, type FieldTheme } from '../theme/index.js';
import type { TextSize } from '../lib/settings/preferences.js';

export interface BannerProps {
  tone: 'safe' | 'info' | 'warn' | 'danger';
  title?: string;
  children?: React.ReactNode;
  theme: FieldTheme;
  textSize: TextSize;
}

export function Banner({ tone, title, children, theme, textSize }: BannerProps) {
  return (
    <View
      accessibilityRole={tone === 'danger' || tone === 'warn' ? 'alert' : undefined}
      style={[
        styles.container,
        {
          backgroundColor: theme.banner[tone],
          borderColor: theme.bannerFg[tone],
        },
      ]}
    >
      {title ? (
        <Text
          style={[
            styles.title,
            { color: theme.bannerFg[tone], fontSize: scaleFontSize(14, textSize) },
          ]}
        >
          {title}
        </Text>
      ) : null}
      {children ? (
        <Text
          style={[
            styles.body,
            { color: theme.bannerFg[tone], fontSize: scaleFontSize(14, textSize) },
          ]}
        >
          {children}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderLeftWidth: 4,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: 8,
    gap: spacing[1],
  },
  title: { fontWeight: '700' },
  body: { fontWeight: '400' },
});
