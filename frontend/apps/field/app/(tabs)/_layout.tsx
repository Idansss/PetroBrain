import { Tabs } from 'expo-router';

import { useSessionStore } from '../../src/lib/session/store';
import { useFieldTheme } from '../../src/lib/session/useColorMode';

/**
 * Bottom tabs: Ask / PTW / Calcs / Logs / Settings.
 *
 * Two-tap-to-answer requirement: the user lands on Ask from boot, types
 * (or presses the mic, when ASR ships), and reads the answer. No
 * intermediate routing.
 */
export default function TabsLayout() {
  const theme = useFieldTheme();
  const textSize = useSessionStore((s) => s.preferences.textSize);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.surfaceMuted },
        headerTitleStyle: { color: theme.text },
        headerTintColor: theme.text,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.surfaceMuted,
          borderTopColor: theme.border,
          minHeight: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontWeight: '600',
          fontSize: 12 * (textSize === 'large' ? 1.15 : textSize === 'small' ? 0.9 : 1),
        },
      }}
    >
      <Tabs.Screen name="ask" options={{ title: 'Ask' }} />
      <Tabs.Screen name="ptw" options={{ title: 'PTW' }} />
      <Tabs.Screen name="calcs" options={{ title: 'Calcs' }} />
      <Tabs.Screen name="logs" options={{ title: 'Logs' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
