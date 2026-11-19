'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, Notice, TextField } from '@/components/ui';
import { api, prepareWrites, unwrap, userMessage } from '@/lib/api';
import { useSession } from '@/lib/session';

/** Second step of sign-in: an authenticator code, or one of the recovery codes. */
export default function VerifySignIn() {
  const router = useRouter();
  const { mfaChallengeId, setMfaChallengeId, refresh } = useSession();
  const [useRecovery, setUseRecovery] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!mfaChallengeId) {
    return (
      <main id="content" className="auth">
        <div className="auth__card stack">
          <h1>Sign-in expired</h1>
          <p>Start again with your email or mobile number and password.</p>
          <Link href="/sign-in" className="btn btn--primary">Back to sign in</Link>
        </div>
      </main>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await prepareWrites();
      unwrap(await api.POST('/auth/mfa/verify', { body: { mfa_challenge_id: mfaChallengeId, ...(useRecovery ? { recovery_code: value.trim() } : { code: value.trim() }) } }));
      setMfaChallengeId(null);
      await refresh();
      router.replace('/');
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main id="content" className="auth">
      <form className="auth__card stack" onSubmit={submit}>
        <h1>Two-step verification</h1>
        <p className="muted">{useRecovery ? 'Enter one of the recovery codes you saved. Each works once.' : 'Enter the 6-digit code from your authenticator app.'}</p>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <TextField
          key={useRecovery ? 'recovery' : 'code'}
          label={useRecovery ? 'Recovery code' : '6-digit code'}
          inputMode={useRecovery ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          maxLength={useRecovery ? 32 : 6}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />
        <Button type="submit" loading={busy}>Verify</Button>
        <Button type="button" variant="ghost" onClick={() => { setUseRecovery((r) => !r); setValue(''); setError(null); }}>
          {useRecovery ? 'Use an authenticator code instead' : 'Use a recovery code instead'}
        </Button>
      </form>
    </main>
  );
}
