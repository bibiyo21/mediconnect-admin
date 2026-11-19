'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Badge, Button, Card, Notice, PageHeader, SelectField, StateMessage, TextField } from '@/components/ui';
import { api, fieldError, prepareWrites, unwrap, userMessage } from '@/lib/api';
import type { ClinicSummary } from '@/lib/clinics';
import { hasRole, useSession } from '@/lib/session';
import { useLoad } from '@/lib/useLoad';

/** Admins see every clinic and can add one; clinic managers and staff see the clinics they belong to. */
export default function Clinics() {
  const { account } = useSession();
  const isAdmin = hasRole(account, 'SUPER_ADMIN', 'ADMIN');
  const { data, error, loading, reload } = useLoad(async () => {
    if (isAdmin) return unwrap(await api.GET('/admin/clinics', { params: { query: { per_page: 100 } as never } })) as ClinicSummary[];
    return unwrap(await api.GET('/me/clinics')) as ClinicSummary[];
  }, [isAdmin]);

  return (
    <>
      <PageHeader title="Clinics" description={isAdmin ? 'Every clinic on MediConnect.' : 'The clinics you work at.'} />
      {isAdmin ? <NewClinic onCreated={reload} /> : null}
      {loading && !data ? <StateMessage state="loading" message="Loading clinics" /> : null}
      {error ? <StateMessage state="error" message={userMessage(error)} onRetry={reload} /> : null}
      {data && data.length === 0 ? <StateMessage state="empty" message={isAdmin ? 'No clinics yet. Add the first one above.' : 'You are not a member of any clinic yet. A clinic manager can add you.'} /> : null}
      {data && data.length > 0 ? (
        <div className="table-wrap" role="region" aria-label="Clinics table" tabIndex={0}>
          <table className="table">
            <thead><tr><th scope="col">Clinic</th><th scope="col">Organization</th><th scope="col">Locations</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/clinics/${c.id}`}>{c.name}</Link></td>
                  <td>{c.organization.name}</td>
                  <td>{c.location_count} {c.cities.length ? <span className="muted">· {c.cities.join(', ')}</span> : null}</td>
                  <td>{c.status === 'ACTIVE' ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}

function NewClinic({ onCreated }: { onCreated: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ orgName: '', orgType: 'CLINIC_GROUP', name: '', locName: '', address: '', city: '', phone: '' });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  if (!open) return <div><Button variant="secondary" onClick={() => setOpen(true)}>Add a clinic</Button></div>;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await prepareWrites();
      const created = unwrap(await api.POST('/admin/clinics', { body: {
        organization: { name: form.orgName.trim(), organization_type: form.orgType as 'CLINIC_GROUP' },
        name: form.name.trim(),
        location: { name: form.locName.trim(), address_line1: form.address.trim(), city: form.city.trim(), phone: form.phone.trim() || null },
      } as never }));
      onCreated();
      router.push(`/clinics/${(created as { id: string }).id}`);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Add a clinic">
      {error && !fieldError(error, 'name') ? <Notice tone="error">{userMessage(error)}</Notice> : null}
      <form className="stack" onSubmit={submit}>
        <div className="filters">
          <TextField label="Organization name" value={form.orgName} onChange={set('orgName')} error={fieldError(error, 'organization.name')} required />
          <SelectField label="Organization type" value={form.orgType} onChange={set('orgType')}>
            <option value="CLINIC_GROUP">Clinic group</option>
            <option value="HOSPITAL">Hospital</option>
            <option value="SOLO_PRACTICE">Solo practice</option>
          </SelectField>
          <TextField label="Clinic name" hint="No phone numbers in names" value={form.name} onChange={set('name')} error={fieldError(error, 'name')} required />
        </div>
        <div className="filters">
          <TextField label="First location name" value={form.locName} onChange={set('locName')} error={fieldError(error, 'location.name')} required />
          <TextField label="Street address" value={form.address} onChange={set('address')} error={fieldError(error, 'location.address_line1')} required />
          <TextField label="City" value={form.city} onChange={set('city')} error={fieldError(error, 'location.city')} required />
          <TextField label="Phone (optional)" type="tel" value={form.phone} onChange={set('phone')} error={fieldError(error, 'location.phone')} />
        </div>
        <div className="row-actions">
          <Button type="submit" loading={busy}>Create clinic</Button>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
