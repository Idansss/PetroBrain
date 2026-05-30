import { Redirect } from 'expo-router';

import { useSessionStore } from '../src/lib/session/store';

/** Initial route: bounce to /auth or /(tabs)/ask based on session state. */
export default function Index() {
  const token = useSessionStore((s) => s.token);
  return <Redirect href={token ? '/(tabs)/ask' : '/auth'} />;
}
