'use client';

/**
 * Sensitive actions need a fresh second-factor check (rbac-permissions.md §7).
 * `useStepUp().run(action)` runs the action; if the API answers
 * STEP_UP_REQUIRED, it asks for an authenticator code, verifies it with
 * POST /auth/mfa/step-up, and runs the action once more.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { api, isStepUpRequired, prepareWrites, StepUpCancelled, unwrap, userMessage } from '@/lib/api';
import { Button, Notice, TextField } from './ui';

type Run = <T>(action: () => Promise<T>) => Promise<T>;

const Ctx = createContext<Run | null>(null);

export function StepUpProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ resolve: () => void; reject: (e: unknown) => void } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  const ask = useCallback(() => new Promise<void>((resolve, reject) => {
    pending.current = { resolve, reject };
    setCode('');
    setError(null);
    setOpen(true);
  }), []);

  const run: Run = useCallback(async (action) => {
    try {
      return await action();
    } catch (e) {
      if (!isStepUpRequired(e)) throw e;
      await ask();
      return action();
    }
  }, [ask]);

  const cancel = () => {
    setOpen(false);
    pending.current?.reject(new StepUpCancelled());
    pending.current = null;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await prepareWrites();
      unwrap(await api.POST('/auth/mfa/step-up', { body: { code: code.trim() } }));
      setOpen(false);
      pending.current?.resolve();
      pending.current = null;
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Ctx.Provider value={run}>
      {children}
      <dialog ref={dialog} className="dialog" aria-labelledby="step-up-title" onCancel={(e) => { e.preventDefault(); cancel(); }}>
        <form onSubmit={submit} className="stack">
          <h2 id="step-up-title">Confirm it is you</h2>
          <p>This action needs a fresh code from your authenticator app.</p>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <TextField label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required />
          <div className="dialog__actions">
            <Button type="button" variant="secondary" onClick={cancel}>Cancel</Button>
            <Button type="submit" loading={busy}>Verify</Button>
          </div>
        </form>
      </dialog>
    </Ctx.Provider>
  );
}

export function useStepUp(): Run {
  const run = useContext(Ctx);
  if (!run) throw new Error('useStepUp outside StepUpProvider');
  return run;
}
