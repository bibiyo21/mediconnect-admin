'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useStepUp } from '@/components/StepUp';
import { Button, Card, Notice, PageHeader, StateMessage, TextField } from '@/components/ui';
import { ROLES, StatusBadge } from '@/components/users';
import { api, fieldError, formatDateTime, prepareWrites, unwrap, userMessage, type AdminUser } from '@/lib/api';
import { hasRole, useSession } from '@/lib/session';
import { useLoad } from '@/lib/useLoad';

type Role = (typeof ROLES)[number];

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const { account } = useSession();
  const runWithStepUp = useStepUp();
  const { data: user, error, loading, reload } = useLoad(async () => unwrap(await api.GET('/admin/users/{userId}', { params: { path: { userId: id } } })), [id]);
  const [current, setCurrent] = useState<AdminUser | null>(null);
  const shown = current ?? user;

  const [reason, setReason] = useState('');
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [roleReason, setRoleReason] = useState('');
  const [actionError, setActionError] = useState<unknown>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState<'status' | 'roles' | null>(null);

  if (loading && !user) return <StateMessage state="loading" message="Loading account" />;
  if (error || !shown) return <StateMessage state="error" message={userMessage(error)} onRetry={reload} />;

  const isSelf = account?.id === shown.id;
  const canSuspend = hasRole(account, 'SUPER_ADMIN', 'ADMIN') && !isSelf;
  const canManageRoles = hasRole(account, 'SUPER_ADMIN') && !isSelf;
  const selectedRoles = roles ?? (shown.roles as Role[]);
  const suspended = shown.status === 'SUSPENDED';

  const changeStatus = async (event: FormEvent) => {
    event.preventDefault();
    setBusy('status');
    setActionError(null);
    setDone(null);
    try {
      const updated = await runWithStepUp(async () => {
        await prepareWrites();
        const path = suspended ? '/admin/users/{userId}/reactivate' : '/admin/users/{userId}/suspend';
        return unwrap(await api.POST(path, { params: { path: { userId: shown.id } }, body: { reason } }));
      });
      setCurrent(updated);
      setReason('');
      setDone(suspended ? 'The account was reactivated.' : 'The account was suspended and signed out everywhere.');
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(null);
    }
  };

  const saveRoles = async (event: FormEvent) => {
    event.preventDefault();
    setBusy('roles');
    setActionError(null);
    setDone(null);
    try {
      const updated = await runWithStepUp(async () => {
        await prepareWrites();
        return unwrap(await api.PUT('/admin/users/{userId}/roles', { params: { path: { userId: shown.id } }, body: { roles: selectedRoles, reason: roleReason } }));
      });
      setCurrent(updated);
      setRoles(null);
      setRoleReason('');
      setDone('Roles updated.');
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(null);
    }
  };

  const name = [shown.first_name, shown.last_name].filter(Boolean).join(' ') || 'No name';
  return (
    <>
      <p><Link href="/users">← All users</Link></p>
      <PageHeader title={name} description={shown.email ?? shown.mobile_masked ?? undefined} actions={<StatusBadge user={shown} />} />
      {done ? <Notice tone="success">{done}</Notice> : null}
      {actionError && !fieldError(actionError, 'reason') ? <Notice tone="error">{userMessage(actionError)}</Notice> : null}

      <div className="grid-2">
        <Card title="Account">
          <dl className="details">
            <dt>Email</dt><dd>{shown.email ?? '—'}</dd>
            <dt>Mobile</dt><dd>{shown.mobile_masked ?? '—'}</dd>
            <dt>Roles</dt><dd>{shown.roles.join(', ') || '—'}</dd>
            <dt>Two-step verification</dt><dd>{shown.mfa_enrolled ? 'Set up' : 'Not set up'}</dd>
            <dt>Last sign-in</dt><dd>{formatDateTime(shown.last_login_at)}</dd>
            <dt>Created</dt><dd>{formatDateTime(shown.created_at)}</dd>
            {shown.deletion_requested_at ? (<><dt>Deletion requested</dt><dd>{formatDateTime(shown.deletion_requested_at)}</dd></>) : null}
          </dl>
        </Card>

        {canSuspend ? (
          <Card title={suspended ? 'Reactivate account' : 'Suspend account'}>
            <form className="stack" onSubmit={changeStatus}>
              <p className="muted">{suspended ? 'The user will be able to sign in again.' : 'The user is signed out on every device and cannot sign in until reactivated.'} You will be asked for an authenticator code.</p>
              <TextField label="Reason" hint="Recorded in the audit log, for example a ticket number." value={reason} onChange={(e) => setReason(e.target.value)} error={fieldError(actionError, 'reason')} required minLength={5} />
              <Button type="submit" variant={suspended ? 'secondary' : 'danger'} loading={busy === 'status'}>{suspended ? 'Reactivate account' : 'Suspend account'}</Button>
            </form>
          </Card>
        ) : null}
      </div>

      {canManageRoles ? (
        <Card title="Roles">
          <form className="stack" onSubmit={saveRoles}>
            <fieldset className="checks">
              <legend>Roles this account holds</legend>
              {ROLES.map((r) => (
                <label key={r} className="check">
                  <input type="checkbox" checked={selectedRoles.includes(r)} onChange={(e) => setRoles(e.target.checked ? [...selectedRoles, r] : selectedRoles.filter((x) => x !== r))} />
                  {r}
                </label>
              ))}
            </fieldset>
            <p className="muted small">ADMIN cannot be combined with SUPER_ADMIN or MEDICAL_ADMIN (D-32). Privileged roles must set up two-step verification at their next sign-in.</p>
            <TextField label="Reason for the change" value={roleReason} onChange={(e) => setRoleReason(e.target.value)} required minLength={5} />
            <Button type="submit" variant="secondary" loading={busy === 'roles'}>Save roles</Button>
          </form>
        </Card>
      ) : null}
      {isSelf ? <Notice>This is your own account. Changes to it are made by another administrator.</Notice> : null}
    </>
  );
}
