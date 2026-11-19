'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Notice, TextField } from '@/components/ui';
import { api, fieldError, prepareWrites, unwrap, userMessage } from '@/lib/api';
import { useSession } from '@/lib/session';

type LoginData = { mfa_required: true; mfa_challenge_id: string } | { mfa: { setup_required: boolean } };

export default function SignIn() {
  const router = useRouter();
  const { status, refresh, setMfaChallengeId } = useSession();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === 'signedIn') router.replace('/');
    if (status === 'mfaSetupRequired') router.replace('/mfa/setup');
  }, [status, router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await prepareWrites();
      const data = unwrap(await api.POST('/auth/login', { body: { identifier: identifier.trim(), password } })) as LoginData;
      if ('mfa_required' in data) {
        setMfaChallengeId(data.mfa_challenge_id);
        router.push('/sign-in/verify');
        return;
      }
      await refresh(); // routes to MFA setup or the console via the effect above
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main id="content" className="auth">
      <form className="auth__card stack" onSubmit={submit} noValidate>
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG; next/image adds nothing here */}
        <img src="/assets/brand/logo-mark.svg" alt="" width={56} height={56} className="brand-mark auth__logo" />
        <h1>MediConnect Console</h1>
        <p className="muted">Sign in with your staff account. You will be asked for a code from your authenticator app.</p>
        {error && !fieldError(error, 'identifier') && !fieldError(error, 'password') ? <Notice tone="error">{userMessage(error)}</Notice> : null}
        <TextField label="Email or mobile number" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} error={fieldError(error, 'identifier')} required />
        <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fieldError(error, 'password')} required />
        <Button type="submit" loading={busy}>Sign in</Button>
      </form>
    </main>
  );
}
