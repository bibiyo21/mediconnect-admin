'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Notice, StateMessage, TextField } from '@/components/ui';
import { api, prepareWrites, unwrap, userMessage } from '@/lib/api';
import { useSession } from '@/lib/session';

/**
 * Privileged accounts must enrol an authenticator before using the console.
 * Shows the setup key (and otpauth link), confirms with a code, then shows
 * the recovery codes once.
 */
export default function MfaSetup() {
  const router = useRouter();
  const { status, refresh, signOut } = useSession();
  const [setup, setSetup] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === 'signedOut') router.replace('/sign-in');
    if (status === 'signedIn' && !recoveryCodes) router.replace('/');
  }, [status, router, recoveryCodes]);

  useEffect(() => {
    if (status !== 'mfaSetupRequired' || setup) return;
    void (async () => {
      try {
        await prepareWrites();
        setSetup(unwrap(await api.POST('/auth/mfa/totp/setup')) as { secret: string; otpauth_uri: string });
      } catch (e) {
        setError(userMessage(e));
      }
    })();
  }, [status, setup]);

  const confirm = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await prepareWrites();
      const data = unwrap(await api.POST('/auth/mfa/totp/confirm', { body: { code: code.trim() } })) as { recovery_codes: string[] };
      setRecoveryCodes(data.recovery_codes);
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (recoveryCodes) {
    return (
      <main id="content" className="auth">
        <div className="auth__card stack">
          <h1>Save your recovery codes</h1>
          <p>Each code signs you in once if you lose your phone. Store them somewhere safe; they will not be shown again.</p>
          <ul className="codes" aria-label="Recovery codes">
            {recoveryCodes.map((c) => <li key={c}><code>{c}</code></li>)}
          </ul>
          <Button onClick={async () => { await refresh(); router.replace('/'); }}>I have saved them, continue</Button>
        </div>
      </main>
    );
  }

  return (
    <main id="content" className="auth">
      <form className="auth__card stack" onSubmit={confirm}>
        <h1>Set up two-step verification</h1>
        <p className="muted">Console accounts need an authenticator app (for example Google Authenticator or Microsoft Authenticator).</p>
        {error ? <Notice tone="error">{error}</Notice> : null}
        {!setup && !error ? <StateMessage state="loading" message="Preparing your setup key" /> : null}
        {setup ? (
          <>
            <ol className="steps">
              <li>In your authenticator app, add an account using a setup key.</li>
              <li>
                Enter this key: <code className="secret" aria-label="Setup key">{setup.secret.match(/.{1,4}/g)?.join(' ')}</code>
              </li>
              <li>Type the 6-digit code the app shows.</li>
            </ol>
            <p className="muted small">On a phone, you can also <a href={setup.otpauth_uri}>open the setup link</a> in your authenticator app.</p>
            <TextField label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required />
            <Button type="submit" loading={busy}>Confirm</Button>
          </>
        ) : null}
        <Button type="button" variant="ghost" onClick={() => void signOut()}>Sign out</Button>
      </form>
    </main>
  );
}
