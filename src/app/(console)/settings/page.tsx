'use client';

import { useState, type FormEvent } from 'react';
import { useStepUp } from '@/components/StepUp';
import { Button, Card, Notice, PageHeader, StateMessage, TextField } from '@/components/ui';
import { api, fieldError, formatDateTime, prepareWrites, unwrap, userMessage } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';

interface Setting { key: string; value: unknown; updated_by: string | null; updated_at: string | null }

/** Platform settings. Values are JSON; secrets are refused by the API. Changes need step-up and a reason. */
export default function Settings() {
  const runWithStepUp = useStepUp();
  const { data, error, loading, reload } = useLoad(async () => unwrap(await api.GET('/admin/settings')) as Setting[], []);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<unknown>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const edit = (s: Setting) => {
    setKey(s.key);
    setValue(JSON.stringify(s.value));
    setSaved(null);
    setFormError(null);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    setFormError(null);
    setSaved(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      setLocalError('Enter the value as JSON: a number (60), true/false, "text" in quotes, or an object.');
      return;
    }
    setBusy(true);
    try {
      await runWithStepUp(async () => {
        await prepareWrites();
        return unwrap(await api.PUT('/admin/settings/{settingKey}', { params: { path: { settingKey: key.trim() } }, body: { value: parsed as never, reason } }));
      });
      setSaved(`Saved ${key.trim()}.`);
      setReason('');
      reload();
    } catch (e) {
      setFormError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings" description="Platform settings. Never store passwords, tokens or keys here." />
      {saved ? <Notice tone="success">{saved}</Notice> : null}
      {formError && !fieldError(formError, 'reason') ? <Notice tone="error">{userMessage(formError)}</Notice> : null}
      <div className="grid-2">
        <Card title="Current settings">
          {loading && !data ? <StateMessage state="loading" message="Loading settings" /> : null}
          {error ? <StateMessage state="error" message={userMessage(error)} onRetry={reload} /> : null}
          {data && data.length === 0 ? <StateMessage state="empty" message="No settings have been saved yet." /> : null}
          {data && data.length > 0 ? (
            <ul className="settings-list">
              {data.map((s) => (
                <li key={s.key}>
                  <div>
                    <code>{s.key}</code> = <code>{JSON.stringify(s.value)}</code>
                    <p className="muted small">Updated {formatDateTime(s.updated_at)}</p>
                  </div>
                  <Button variant="ghost" onClick={() => edit(s)} aria-label={`Edit ${s.key}`}>Edit</Button>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
        <Card title="Change a setting">
          <form className="stack" onSubmit={save}>
            <TextField label="Key" hint="Lowercase, dots and underscores, for example booking.max_days_ahead" value={key} onChange={(e) => setKey(e.target.value)} required pattern="[a-z][a-z0-9_.]{2,99}" />
            <TextField label="Value (JSON)" value={value} onChange={(e) => setValue(e.target.value)} error={localError ?? fieldError(formError, 'value')} required />
            <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} error={fieldError(formError, 'reason')} required minLength={5} />
            <Button type="submit" loading={busy}>Save setting</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
