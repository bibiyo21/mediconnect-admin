'use client';

/**
 * Who is signed in to the console. The source of truth is the server session:
 * GET /auth/me answers 200 (signed in), 401 MFA_REQUIRED (signed in, MFA still
 * to set up) or 401 (signed out).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, prepareWrites, unwrap, type Account } from './api';

type Status = 'loading' | 'signedOut' | 'mfaSetupRequired' | 'signedIn';

interface SessionValue {
  status: Status;
  account: Account | null;
  /** The pending second-factor challenge after a password sign-in (memory only). */
  mfaChallengeId: string | null;
  setMfaChallengeId: (id: string | null) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionValue | null>(null);

/** Roles that may use the console (the API enforces each permission again). */
export const CONSOLE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MEDICAL_ADMIN', 'SUPPORT_AGENT', 'FINANCE_OFFICER', 'MODERATOR', 'CLINIC_MANAGER', 'CLINIC_STAFF'];

/** Roles that see the platform-wide admin sections (the rest work inside their clinics). */
export const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MEDICAL_ADMIN', 'SUPPORT_AGENT', 'FINANCE_OFFICER', 'MODERATOR'];

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [account, setAccount] = useState<Account | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setAccount(unwrap(await api.GET('/auth/me')));
      setStatus('signedIn');
    } catch (error) {
      setAccount(null);
      setStatus(error instanceof ApiError && error.code === 'MFA_REQUIRED' ? 'mfaSetupRequired' : 'signedOut');
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await prepareWrites();
      await api.POST('/auth/logout');
    } finally {
      setAccount(null);
      setStatus('signedOut');
    }
  }, []);

  useEffect(() => {
    // Initial session check against the server; state updates happen after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ status, account, mfaChallengeId, setMfaChallengeId, refresh, signOut }), [status, account, mfaChallengeId, refresh, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(Ctx);
  if (!value) throw new Error('useSession outside SessionProvider');
  return value;
}

export function hasRole(account: Account | null, ...roles: string[]): boolean {
  return Boolean(account?.roles.some((r) => roles.includes(r)));
}
