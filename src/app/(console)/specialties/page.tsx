'use client';

import { useState, type FormEvent } from 'react';
import { Badge, Button, Card, Notice, PageHeader, StateMessage, TextField } from '@/components/ui';
import { api, fieldError, prepareWrites, unwrap, userMessage } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';

interface Sub { id: string; name: string; slug: string; is_active: boolean }
interface Specialty { id: string; name: string; slug: string; synonyms: string[]; is_active: boolean; review_status: 'PENDING_REVIEW' | 'REVIEWED'; subspecialties: Sub[] }

const splitSynonyms = (text: string) => text.split(',').map((s) => s.trim()).filter(Boolean);

/**
 * Clinical reference data (D-39, `specialties.manage`). The seeded list starts
 * "Pending review": a medical administrator confirms or edits each entry.
 * Entries are deactivated, never deleted.
 */
export default function Specialties() {
  const { data, error, loading, reload } = useLoad(async () => unwrap(await api.GET('/admin/specialties')) as Specialty[], []);
  const [onlyPending, setOnlyPending] = useState(false);
  const [name, setName] = useState('');
  const [synonyms, setSynonyms] = useState('');
  const [createError, setCreateError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setCreateError(null);
    try {
      await prepareWrites();
      unwrap(await api.POST('/admin/specialties', { body: { name: name.trim(), synonyms: splitSynonyms(synonyms) } }));
      setNotice(`Added ${name.trim()}.`);
      setName('');
      setSynonyms('');
      reload();
    } catch (e) {
      setCreateError(e);
    } finally {
      setBusy(false);
    }
  };

  const list = (data ?? []).filter((s) => !onlyPending || s.review_status === 'PENDING_REVIEW');
  const pending = (data ?? []).filter((s) => s.review_status === 'PENDING_REVIEW').length;

  return (
    <>
      <PageHeader title="Specialties" description="Specialties and subspecialties patients search by. Deactivate entries instead of deleting them." />
      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {pending > 0 ? <Notice tone="warning">{pending} seeded {pending === 1 ? 'entry is' : 'entries are'} waiting for medical review. Check each name and its synonyms, then mark it reviewed.</Notice> : null}

      <Card title="Add a specialty">
        <form className="filters" onSubmit={create}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} error={fieldError(createError, 'name')} required minLength={2} />
          <TextField label="Synonyms (comma-separated)" placeholder="sports doctor, sports physician" value={synonyms} onChange={(e) => setSynonyms(e.target.value)} />
          <Button type="submit" loading={busy}>Add specialty</Button>
        </form>
        {createError && !fieldError(createError, 'name') ? <Notice tone="error">{userMessage(createError)}</Notice> : null}
      </Card>

      <label className="check">
        <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
        Show only entries waiting for review
      </label>

      {loading && !data ? <StateMessage state="loading" message="Loading specialties" /> : null}
      {error ? <StateMessage state="error" message={userMessage(error)} onRetry={reload} /> : null}
      {data && list.length === 0 ? <StateMessage state="empty" message={onlyPending ? 'Nothing is waiting for review.' : 'No specialties yet.'} /> : null}
      <div className="stack">
        {list.map((s) => <SpecialtyRow key={s.id} specialty={s} onChanged={(msg) => { setNotice(msg); reload(); }} />)}
      </div>
    </>
  );
}

function SpecialtyRow({ specialty, onChanged }: { specialty: Specialty; onChanged: (message: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(specialty.name);
  const [synonyms, setSynonyms] = useState(specialty.synonyms.join(', '));
  const [subName, setSubName] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const patch = async (body: Record<string, unknown>, message: string, key: string) => {
    setBusy(key);
    setError(null);
    try {
      await prepareWrites();
      unwrap(await api.PATCH('/admin/specialties/{specialtyId}', { params: { path: { specialtyId: specialty.id } }, body: body as never }));
      setEditing(false);
      onChanged(message);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  const addSub = async (event: FormEvent) => {
    event.preventDefault();
    setBusy('sub');
    setError(null);
    try {
      await prepareWrites();
      unwrap(await api.POST('/admin/specialties/{specialtyId}/subspecialties', { params: { path: { specialtyId: specialty.id } }, body: { name: subName.trim() } }));
      setSubName('');
      onChanged(`Added ${subName.trim()} to ${specialty.name}.`);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  const toggleSub = async (sub: Sub) => {
    setBusy(sub.id);
    setError(null);
    try {
      await prepareWrites();
      unwrap(await api.PATCH('/admin/subspecialties/{subspecialtyId}', { params: { path: { subspecialtyId: sub.id } }, body: { is_active: !sub.is_active } }));
      onChanged(`${sub.name} ${sub.is_active ? 'deactivated' : 'reactivated'}.`);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="card" aria-labelledby={`specialty-${specialty.id}`}>
      <div className="page-header">
        <div>
          <h2 id={`specialty-${specialty.id}`} className="card__title">{specialty.name}</h2>
          <p className="muted small">{specialty.synonyms.length ? `Also searched as: ${specialty.synonyms.join(', ')}` : 'No synonyms'}</p>
        </div>
        <div className="badges">
          {specialty.review_status === 'PENDING_REVIEW' ? <Badge tone="warning">Pending review</Badge> : <Badge tone="success">Reviewed</Badge>}
          {specialty.is_active ? null : <Badge>Inactive</Badge>}
        </div>
      </div>
      {error ? <Notice tone="error">{userMessage(error)}</Notice> : null}

      {editing ? (
        <form className="filters" onSubmit={(e) => { e.preventDefault(); void patch({ name: name.trim(), synonyms: splitSynonyms(synonyms) }, `Saved ${name.trim()}.`, 'save'); }}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} error={fieldError(error, 'name')} required />
          <TextField label="Synonyms (comma-separated)" value={synonyms} onChange={(e) => setSynonyms(e.target.value)} />
          <Button type="submit" loading={busy === 'save'}>Save</Button>
          <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
        </form>
      ) : (
        <div className="row-actions">
          <Button variant="secondary" onClick={() => setEditing(true)} aria-label={`Edit ${specialty.name}`}>Edit</Button>
          {specialty.review_status === 'PENDING_REVIEW' ? (
            <Button variant="secondary" loading={busy === 'review'} onClick={() => void patch({ reviewed: true }, `${specialty.name} marked as reviewed.`, 'review')} aria-label={`Mark ${specialty.name} as reviewed`}>Mark reviewed</Button>
          ) : null}
          <Button variant={specialty.is_active ? 'danger' : 'secondary'} loading={busy === 'active'} onClick={() => void patch({ is_active: !specialty.is_active }, `${specialty.name} ${specialty.is_active ? 'deactivated' : 'reactivated'}.`, 'active')} aria-label={`${specialty.is_active ? 'Deactivate' : 'Reactivate'} ${specialty.name}`}>
            {specialty.is_active ? 'Deactivate' : 'Reactivate'}
          </Button>
        </div>
      )}

      <details>
        <summary>Subspecialties ({specialty.subspecialties.length})</summary>
        <ul className="settings-list">
          {specialty.subspecialties.map((sub) => (
            <li key={sub.id}>
              <span>{sub.name} {sub.is_active ? null : <Badge>Inactive</Badge>}</span>
              <Button variant="ghost" loading={busy === sub.id} onClick={() => void toggleSub(sub)} aria-label={`${sub.is_active ? 'Deactivate' : 'Reactivate'} ${sub.name}`}>{sub.is_active ? 'Deactivate' : 'Reactivate'}</Button>
            </li>
          ))}
        </ul>
        <form className="filters" onSubmit={addSub}>
          <TextField label={`New subspecialty of ${specialty.name}`} value={subName} onChange={(e) => setSubName(e.target.value)} required minLength={2} />
          <Button type="submit" variant="secondary" loading={busy === 'sub'}>Add subspecialty</Button>
        </form>
      </details>
    </section>
  );
}
