'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Loads data on mount and whenever `deps` change (compared by value);
 * exposes loading, error and reload. The latest `load` is always used.
 */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]): { data: T | null; error: unknown; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  const key = JSON.stringify(deps);

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let cancelled = false;
    // An async request: these state changes describe its lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    loadRef.current()
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e: unknown) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key, tick]);

  return { data, error, loading, reload: () => setTick((t) => t + 1) };
}
