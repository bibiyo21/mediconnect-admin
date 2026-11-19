'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Badge, Button, Card, Notice, PageHeader, SelectField, StateMessage, TextField } from '@/components/ui';
import { api, fieldError, formatDateTime, prepareWrites, unwrap, userMessage } from '@/lib/api';
import { DAYS, hoursSummary, type ClinicDetail, type ClinicLocation } from '@/lib/clinics';
import { useLoad } from '@/lib/useLoad';

type Hour = { day_of_week: number; opens_at: string; closes_at: string };

export default function ClinicPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useLoad(async () => unwrap(await api.GET('/clinics/{clinicId}/management', { params: { path: { clinicId: id } } })) as ClinicDetail, [id]);
  const [clinic, setClinic] = useState<ClinicDetail | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const shown = clinic ?? data;

  if (loading && !data) return <StateMessage state="loading" message="Loading clinic" />;
  if (error || !shown) return <StateMessage state="error" message={userMessage(error)} onRetry={reload} />;

  const done = (updated: ClinicDetail, message: string) => {
    setClinic(updated);
    setNotice(message);
  };
  const can = shown.abilities;

  return (
    <>
      <p><Link href="/clinics">← All clinics</Link></p>
      <PageHeader title={shown.name} description={`${shown.organization.name} · ${shown.organization.organization_type.replace('_', ' ').toLowerCase()}`} actions={shown.status === 'ACTIVE' ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>} />
      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {!can.update && !can.manage_hours && !can.manage_staff ? <Notice>You can view this clinic. Changes are made by its managers.</Notice> : null}

      <ClinicDetails clinic={shown} onDone={done} />
      {shown.locations.length === 0 ? <StateMessage state="empty" message="This clinic has no locations yet." /> : null}
      {shown.locations.map((l) => <LocationCard key={l.id} clinic={shown} location={l} onDone={done} />)}
      {can.update ? <NewLocation clinicId={shown.id} onDone={done} /> : null}
      <Holidays clinic={shown} onDone={done} />
      <Staff clinic={shown} onDone={done} />
    </>
  );
}

type Done = (clinic: ClinicDetail, message: string) => void;

function useAction() {
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await prepareWrites();
      await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };
  return { error, busy, run };
}

function ClinicDetails({ clinic, onDone }: { clinic: ClinicDetail; onDone: Done }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(clinic.name);
  const [description, setDescription] = useState(clinic.description ?? '');
  const { error, busy, run } = useAction();

  const save = (event: FormEvent) => {
    event.preventDefault();
    void run('save', async () => {
      const updated = unwrap(await api.PATCH('/clinics/{clinicId}', { params: { path: { clinicId: clinic.id } }, body: { name: name.trim(), description: description.trim() || null } })) as ClinicDetail;
      setEditing(false);
      onDone(updated, 'Clinic details saved.');
    });
  };

  return (
    <Card title="Clinic details">
      {editing ? (
        <form className="stack" onSubmit={save}>
          {error && !fieldError(error, 'name') ? <Notice tone="error">{userMessage(error)}</Notice> : null}
          <TextField label="Clinic name" value={name} onChange={(e) => setName(e.target.value)} error={fieldError(error, 'name')} required />
          <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="row-actions">
            <Button type="submit" loading={busy === 'save'}>Save</Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </form>
      ) : (
        <>
          <p>{clinic.description ?? <span className="muted">No description.</span>}</p>
          {clinic.abilities.update ? <div><Button variant="secondary" onClick={() => setEditing(true)}>Edit clinic details</Button></div> : null}
        </>
      )}
    </Card>
  );
}

function LocationCard({ clinic, location, onDone }: { clinic: ClinicDetail; location: ClinicLocation; onDone: Done }) {
  const [editingHours, setEditingHours] = useState(false);
  const [hours, setHours] = useState<Hour[]>(location.operating_hours);
  const [service, setService] = useState({ name: '', minutes: '' });
  const { error, busy, run } = useAction();

  const saveHours = (event: FormEvent) => {
    event.preventDefault();
    void run('hours', async () => {
      const updated = unwrap(await api.PUT('/clinics/{clinicId}/locations/{locationId}/operating-hours', { params: { path: { clinicId: clinic.id, locationId: location.id } }, body: { hours } })) as ClinicDetail;
      setEditingHours(false);
      onDone(updated, `Hours saved for ${location.name}.`);
    });
  };

  const addService = (event: FormEvent) => {
    event.preventDefault();
    void run('service', async () => {
      const updated = unwrap(await api.POST('/clinics/{clinicId}/locations/{locationId}/services', {
        params: { path: { clinicId: clinic.id, locationId: location.id } },
        body: { name: service.name.trim(), default_duration_minutes: service.minutes ? Number(service.minutes) : null },
      })) as ClinicDetail;
      setService({ name: '', minutes: '' });
      onDone(updated, `Added ${service.name.trim()}.`);
    });
  };

  const address = [location.address_line1, location.address_line2, location.barangay, location.city, location.province, location.postal_code].filter(Boolean).join(', ');
  return (
    <section className="card" aria-labelledby={`loc-${location.id}`}>
      <div className="page-header">
        <div>
          <h2 id={`loc-${location.id}`} className="card__title">{location.name}</h2>
          <p className="muted small">{address}{location.hospital_name ? ` · ${location.hospital_name}` : ''}</p>
        </div>
        {location.status === 'ACTIVE' ? null : <Badge>Inactive</Badge>}
      </div>
      {error ? <Notice tone="error">{userMessage(error)}</Notice> : null}
      <dl className="details">
        <dt>Phone</dt><dd>{location.phone ?? '—'}</dd>
        <dt>Time zone</dt><dd>{location.timezone}</dd>
        <dt>Hours</dt><dd>{hoursSummary(location.operating_hours)}</dd>
      </dl>

      {editingHours ? (
        <form className="stack" onSubmit={saveHours}>
          <fieldset className="hours">
            <legend>Weekly hours for {location.name}</legend>
            {hours.length === 0 ? <p className="muted">No hours: the location shows as closed every day.</p> : null}
            {hours.map((h, i) => (
              <div className="hours__row" key={i}>
                <SelectField label="Day" value={String(h.day_of_week)} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, day_of_week: Number(e.target.value) } : x)))}>
                  {DAYS.map((d, k) => <option key={d} value={k + 1}>{d}</option>)}
                </SelectField>
                <TextField label="Opens" type="time" value={h.opens_at} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, opens_at: e.target.value } : x)))} error={fieldError(error, `hours.${i}.opens_at`)} required />
                <TextField label="Closes" type="time" value={h.closes_at} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, closes_at: e.target.value } : x)))} error={fieldError(error, `hours.${i}.closes_at`)} required />
                <Button type="button" variant="ghost" onClick={() => setHours(hours.filter((_, j) => j !== i))} aria-label={`Remove ${DAYS[h.day_of_week - 1]} ${h.opens_at} to ${h.closes_at}`}>Remove</Button>
              </div>
            ))}
          </fieldset>
          <div className="row-actions">
            <Button type="button" variant="secondary" onClick={() => setHours([...hours, { day_of_week: 1, opens_at: '08:00', closes_at: '17:00' }])}>Add hours</Button>
            <Button type="submit" loading={busy === 'hours'}>Save hours</Button>
            <Button type="button" variant="ghost" onClick={() => { setHours(location.operating_hours); setEditingHours(false); }}>Cancel</Button>
          </div>
        </form>
      ) : clinic.abilities.manage_hours ? (
        <div><Button variant="secondary" onClick={() => setEditingHours(true)} aria-label={`Edit hours for ${location.name}`}>Edit hours</Button></div>
      ) : null}

      <details>
        <summary>Services ({location.services.length})</summary>
        <ul className="settings-list">
          {location.services.map((s) => (
            <li key={s.id}><span>{s.name}{s.default_duration_minutes ? <span className="muted"> · {s.default_duration_minutes} min</span> : null}</span>{s.status === 'ACTIVE' ? null : <Badge>Inactive</Badge>}</li>
          ))}
        </ul>
        {clinic.abilities.update ? (
          <form className="filters" onSubmit={addService}>
            <TextField label={`New service at ${location.name}`} value={service.name} onChange={(e) => setService({ ...service, name: e.target.value })} error={fieldError(error, 'name')} required />
            <TextField label="Usual length (minutes)" type="number" min={5} max={480} value={service.minutes} onChange={(e) => setService({ ...service, minutes: e.target.value })} />
            <Button type="submit" variant="secondary" loading={busy === 'service'}>Add service</Button>
          </form>
        ) : null}
      </details>
    </section>
  );
}

function NewLocation({ clinicId, onDone }: { clinicId: string; onDone: Done }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', city: '', phone: '' });
  const { error, busy, run } = useAction();
  if (!open) return <div><Button variant="secondary" onClick={() => setOpen(true)}>Add a location</Button></div>;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run('loc', async () => {
      const updated = unwrap(await api.POST('/clinics/{clinicId}/locations', { params: { path: { clinicId } }, body: { name: form.name.trim(), address_line1: form.address.trim(), city: form.city.trim(), phone: form.phone.trim() || null } })) as ClinicDetail;
      setOpen(false);
      setForm({ name: '', address: '', city: '', phone: '' });
      onDone(updated, `Added location ${form.name.trim()}.`);
    });
  };

  return (
    <Card title="Add a location">
      <form className="filters" onSubmit={submit}>
        <TextField label="Location name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={fieldError(error, 'name')} required />
        <TextField label="Street address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} error={fieldError(error, 'address_line1')} required />
        <TextField label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} error={fieldError(error, 'city')} required />
        <TextField label="Phone (optional)" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={fieldError(error, 'phone')} />
        <Button type="submit" loading={busy === 'loc'}>Add location</Button>
      </form>
    </Card>
  );
}

function Holidays({ clinic, onDone }: { clinic: ClinicDetail; onDone: Done }) {
  const [form, setForm] = useState({ date: '', name: '', closed: 'true', opens: '08:00', closes: '12:00' });
  const { error, busy, run } = useAction();

  const add = (event: FormEvent) => {
    event.preventDefault();
    void run('add', async () => {
      const closed = form.closed === 'true';
      const updated = unwrap(await api.POST('/clinics/{clinicId}/holidays', { params: { path: { clinicId: clinic.id } }, body: {
        date: form.date, name: form.name.trim(), is_closed: closed, ...(closed ? {} : { special_opens_at: form.opens, special_closes_at: form.closes }),
      } as never })) as ClinicDetail;
      setForm({ ...form, date: '', name: '' });
      onDone(updated, `Added ${form.name.trim()}.`);
    });
  };
  const remove = (holidayId: string, name: string) => void run(holidayId, async () => {
    onDone(unwrap(await api.DELETE('/clinics/{clinicId}/holidays/{holidayId}', { params: { path: { clinicId: clinic.id, holidayId } } })) as ClinicDetail, `Removed ${name}.`);
  });

  return (
    <Card title="Closures and special hours">
      {error ? <Notice tone="error">{userMessage(error)}</Notice> : null}
      {clinic.holidays.length === 0 ? <p className="muted">No closures planned.</p> : (
        <ul className="settings-list">
          {clinic.holidays.map((h) => (
            <li key={h.id}>
              <span>{h.date} · {h.name} · {h.is_closed ? 'Closed' : `Open ${h.special_opens_at}–${h.special_closes_at}`}</span>
              {clinic.abilities.manage_hours ? <Button variant="ghost" loading={busy === h.id} onClick={() => remove(h.id, h.name)} aria-label={`Remove ${h.name} on ${h.date}`}>Remove</Button> : null}
            </li>
          ))}
        </ul>
      )}
      {clinic.abilities.manage_hours ? (
        <form className="filters" onSubmit={add}>
          <TextField label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} error={fieldError(error, 'date')} required />
          <TextField label="Name" placeholder="Christmas Day" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <SelectField label="Hours that day" value={form.closed} onChange={(e) => setForm({ ...form, closed: e.target.value })}>
            <option value="true">Closed all day</option>
            <option value="false">Special hours</option>
          </SelectField>
          {form.closed === 'false' ? (
            <>
              <TextField label="Opens" type="time" value={form.opens} onChange={(e) => setForm({ ...form, opens: e.target.value })} />
              <TextField label="Closes" type="time" value={form.closes} onChange={(e) => setForm({ ...form, closes: e.target.value })} error={fieldError(error, 'special_closes_at')} />
            </>
          ) : null}
          <Button type="submit" variant="secondary" loading={busy === 'add'}>Add</Button>
        </form>
      ) : null}
    </Card>
  );
}

function Staff({ clinic, onDone }: { clinic: ClinicDetail; onDone: Done }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('CLINIC_STAFF');
  const { error, busy, run } = useAction();

  const add = (event: FormEvent) => {
    event.preventDefault();
    void run('add', async () => {
      const updated = unwrap(await api.POST('/clinics/{clinicId}/members', { params: { path: { clinicId: clinic.id } }, body: { email: email.trim(), member_role: role as 'CLINIC_STAFF' } })) as ClinicDetail;
      setEmail('');
      onDone(updated, 'Staff member added.');
    });
  };
  const remove = (memberId: string, label: string) => void run(memberId, async () => {
    onDone(unwrap(await api.DELETE('/clinics/{clinicId}/members/{memberId}', { params: { path: { clinicId: clinic.id, memberId } } })) as ClinicDetail, `Removed ${label}.`);
  });

  return (
    <Card title="Staff">
      {error && !fieldError(error, 'email') ? <Notice tone="error">{userMessage(error)}</Notice> : null}
      {clinic.members.length === 0 ? <p className="muted">No staff yet.</p> : (
        <ul className="settings-list">
          {clinic.members.map((m) => (
            <li key={m.id}>
              <span>
                {m.name ?? m.email ?? m.mobile_masked} <Badge tone="info">{m.member_role === 'CLINIC_MANAGER' ? 'Manager' : 'Staff'}</Badge>
                <span className="muted small"> · since {formatDateTime(m.joined_at)}</span>
              </span>
              {clinic.abilities.manage_staff ? <Button variant="ghost" loading={busy === m.id} onClick={() => remove(m.id, m.name ?? 'member')} aria-label={`Remove ${m.name ?? m.email ?? 'member'}`}>Remove</Button> : null}
            </li>
          ))}
        </ul>
      )}
      {clinic.abilities.manage_staff ? (
        <form className="filters" onSubmit={add}>
          <TextField label="Email of their MediConnect account" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={fieldError(error, 'email')} required />
          <SelectField label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="CLINIC_STAFF">Staff (front desk)</option>
            <option value="CLINIC_MANAGER">Manager</option>
          </SelectField>
          <Button type="submit" variant="secondary" loading={busy === 'add'}>Add staff member</Button>
        </form>
      ) : null}
    </Card>
  );
}
