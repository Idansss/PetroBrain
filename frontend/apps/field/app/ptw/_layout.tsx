import { Stack } from 'expo-router';

/**
 * Stack hosting the form + detail routes. The bottom tabs render
 * underneath; this stack only shows when the user drills into a permit.
 */
export default function PtwLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
