import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export interface NetworkStatus {
  online: boolean;
  connectionType: string | null;
}

/**
 * Subscribes to NetInfo updates and returns a stable ``NetworkStatus``.
 *
 * "Online" requires ``isConnected=true`` AND ``isInternetReachable !==
 * false`` so a screen connected to a captive portal still reports
 * offline (the field reality on a rig with patchy 4G).
 */
export function useNetwork(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({ online: true, connectionType: null });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setStatus(toStatus(state));
    });
    NetInfo.fetch().then((state) => setStatus(toStatus(state)));
    return () => unsubscribe();
  }, []);

  return status;
}

function toStatus(state: NetInfoState): NetworkStatus {
  const reachable = state.isInternetReachable !== false;
  return {
    online: Boolean(state.isConnected && reachable),
    connectionType: state.type ?? null,
  };
}
