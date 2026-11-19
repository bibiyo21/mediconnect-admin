'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useStepUp } from '@/components/StepUp';
import { Badge, Button, Card, Notice, PageHeader, StateMessage, TextField } from '@/components/ui';
import { api, fieldError, formatDateTime, prepareWrites, unwrap, userMessage } from '@/lib/api';
import { CREDENTIAL_LABELS, ONBOARDING_LABELS, ONBOARDING_TONES, SCAN_LABELS, fileSize, type Credential, type DoctorApplication } from '@/lib/doctors';
import { useLoad } from '@/lib/useLoad';

/**
 * Review one doctor application (increment 2.9). Documents open through a
 * short-lived signed link; verify, reject and activate ask for an
 * authenticator code. Every view and decision is audited by the API.
 */
export default function DoctorReview() {
  const { id } = useParams<{ id: string }>();
  const runWithStepUp = useStepUp();
  const { data, error, loading, reload } = useLoad(async () => unwrap(await api.GET('/admin/doctors/{doctorId}', { params: { path: { doctorId: id } } })), [id]);
  const [current, setCurrent] = useState<DoctorApplication | null>(null);
  const doctor = current ?? data;

  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [done, setDone] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [links, setLinks] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [verifyReason, setVerifyReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [moreDocuments, setMoreDocuments] = useState(true);

  if (loading && !doctor) return <StateMessage state="loading" message="Loading application" />;
  if (error || !doctor) return <StateMessage state="error" message={userMessage(error)} onRetry={reload} />;

  const status = doctor.onboarding_status;
  const reviewing = status === 'UNDER_REVIEW';
  const path = { doctorId: doctor.id };

  const act = async (key: string, success: string, run: () => Promise<DoctorApplication | null>) => {
    setBusy(key);
    setActionError(null);
    setDone(null);
    try {
      const updated = await run();
      if (updated) setCurrent(updated);
      else reload();
      setDone(success);
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(null);
    }
  };

  const startReview = () => act('start', 'Review started. Check each document, then decide.', async () => {
    await prepareWrites();
    return unwrap(await api.POST('/admin/doctors/{doctorId}/start-review', { params: { path } }));
  });

  // A real link (not window.open after an await, which browsers may block as a popup).
  const getLink = (c: Credential) => act(`open-${c.id}`, 'Download link ready. It works for 5 minutes.', async () => {
    const link = unwrap(await api.GET('/admin/doctors/{doctorId}/credentials/{credentialId}/download-url', { params: { path: { ...path, credentialId: c.id } } }));
    setLinks((current) => ({ ...current, [c.id]: link.url }));
    return null;
  });

  const decide = (c: Credential, decision: 'ACCEPTED' | 'REJECTED') => act(`${decision}-${c.id}`, decision === 'ACCEPTED' ? 'Document accepted.' : 'Document rejected. The doctor sees your note.', async () => {
    await prepareWrites();
    await api.POST('/admin/doctors/{doctorId}/credentials/{credentialId}/review', { params: { path: { ...path, credentialId: c.id } }, body: { decision, note: notes[c.id] || null } }).then(unwrap);
    return null;
  });

  const confirmSpecialties = (event: FormEvent) => {
    event.preventDefault();
    void act('specialties', 'Specialties confirmed. They can now be shown publicly.', async () => {
      await prepareWrites();
      const updated = unwrap(await api.POST('/admin/doctors/{doctorId}/specialties/confirm', { params: { path }, body: { specialty_ids: selected } }));
      setSelected([]);
      return updated;
    });
  };

  const verify = (event: FormEvent) => {
    event.preventDefault();
    void act('verify', 'Verified. The doctor was notified.', () => runWithStepUp(async () => {
      await prepareWrites();
      return unwrap(await api.POST('/admin/doctors/{doctorId}/verify', { params: { path }, body: { reason: verifyReason || null } }));
    }));
  };

  const reject = (event: FormEvent) => {
    event.preventDefault();
    void act('reject', 'Sent back to the doctor with your reason.', () => runWithStepUp(async () => {
      await prepareWrites();
      return unwrap(await api.POST('/admin/doctors/{doctorId}/reject', { params: { path }, body: { reason: rejectReason, more_documents: moreDocuments } }));
    }));
  };

  const activate = () => act('activate', 'Active. The doctor was notified.', () => runWithStepUp(async () => {
    await prepareWrites();
    return unwrap(await api.POST('/admin/doctors/{doctorId}/activate', { params: { path }, body: {} }));
  }));

  const selfReported = doctor.specialties.filter((s) => s.verification_status === 'SELF_REPORTED');
  const fieldErrors = ['reason', 'credentials', 'prc_license_number', 'specialty_ids', 'note'].some((f) => fieldError(actionError, f));

  return (
    <>
      <p><Link href="/doctors">← Verification queue</Link></p>
      <PageHeader
        title={doctor.display_name}
        description={doctor.professional_title ?? undefined}
        actions={<Badge tone={ONBOARDING_TONES[status] ?? 'neutral'}>{ONBOARDING_LABELS[status] ?? status}</Badge>}
      />
      {done ? <Notice tone="success">{done}</Notice> : null}
      {actionError ? <Notice tone="error">{fieldErrors ? (fieldError(actionError, 'credentials') ?? fieldError(actionError, 'prc_license_number') ?? fieldError(actionError, 'specialty_ids') ?? fieldError(actionError, 'note') ?? userMessage(actionError)) : userMessage(actionError)}</Notice> : null}

      {status === 'DOCUMENTS_SUBMITTED' ? (
        <Card title="Start the review">
          <p className="muted">Starting locks the doctor&apos;s licence number and documents while you check them.</p>
          <div><Button onClick={() => void startReview()} loading={busy === 'start'}>Start review</Button></div>
        </Card>
      ) : null}

      <div className="grid-2">
        <Card title="Licence and profile">
          <dl className="details">
            <dt>PRC licence number</dt><dd>{doctor.prc_license_number ?? 'Not given'}</dd>
            <dt>Licence status</dt><dd>{({ NOT_VERIFIED: 'Not verified yet', VERIFIED: 'Verified', REJECTED: 'Rejected' } as Record<string, string>)[doctor.license_verification_status] ?? doctor.license_verification_status}</dd>
            <dt>Medical school</dt><dd>{doctor.medical_school ?? '—'}</dd>
            <dt>Years of experience</dt><dd>{doctor.years_experience ?? '—'}</dd>
            <dt>Profile</dt><dd>{doctor.profile_completeness}% complete</dd>
          </dl>
          <p className="muted small">Check the number and name against the PRC&apos;s own verification service before verifying.</p>
        </Card>

        <Card title="Specialties">
          {doctor.specialties.length === 0 ? <p className="muted">No specialties given.</p> : (
            <form className="stack" onSubmit={confirmSpecialties}>
              <fieldset className="checks">
                <legend>Confirm what the documents support</legend>
                {doctor.specialties.map((s) => {
                  const confirmed = s.verification_status === 'CONFIRMED';
                  const label = `${s.specialty_name}${s.subspecialty_name ? `: ${s.subspecialty_name}` : ''}${s.is_primary ? ' (primary)' : ''}${s.board_certified ? ', board certified' : ''}`;
                  return (
                    <label key={s.id} className="check">
                      <input type="checkbox" disabled={confirmed} checked={confirmed || selected.includes(s.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, s.id] : selected.filter((x) => x !== s.id))} />
                      <span>{label} {confirmed ? <Badge tone="success">Confirmed</Badge> : <Badge>Self-reported</Badge>}</span>
                    </label>
                  );
                })}
              </fieldset>
              {selfReported.length > 0 ? <div><Button type="submit" variant="secondary" disabled={selected.length === 0 || status === 'DOCUMENTS_SUBMITTED'} loading={busy === 'specialties'}>Confirm selected</Button></div> : null}
            </form>
          )}
        </Card>
      </div>

      <Card title="Documents">
        {doctor.credentials.length === 0 ? <p className="muted">No documents uploaded.</p> : (
          <ul className="doc-list">
            {doctor.credentials.map((c) => (
              <li key={c.id} className="doc">
                <div className="doc__head">
                  <div>
                    <p className="doc__title">{CREDENTIAL_LABELS[c.credential_type] ?? c.credential_type}</p>
                    <p className="muted small">{c.original_filename} · {fileSize(c.size_bytes)} · uploaded {formatDateTime(c.uploaded_at)}{c.expires_on ? ` · expires ${c.expires_on}` : ''}</p>
                  </div>
                  <div className="doc__badges">
                    <Badge tone={c.scan_status === 'CLEAN' ? 'success' : c.scan_status === 'PENDING_SCAN' ? 'info' : 'error'}>{SCAN_LABELS[c.scan_status] ?? c.scan_status}</Badge>
                    <Badge tone={c.status === 'ACCEPTED' ? 'success' : c.status === 'REJECTED' ? 'error' : 'neutral'}>{c.status === 'SUBMITTED' ? 'Not reviewed' : c.status === 'ACCEPTED' ? 'Accepted' : 'Rejected'}</Badge>
                  </div>
                </div>
                {c.review_note ? <p className="small">Note to doctor: {c.review_note}</p> : null}
                <div className="doc__actions">
                  {links[c.id] ? (
                    <a className="button-link" href={links[c.id]} download rel="noopener noreferrer">Download {CREDENTIAL_LABELS[c.credential_type] ?? 'document'}</a>
                  ) : (
                    <Button variant="secondary" disabled={!c.downloadable} onClick={() => void getLink(c)} loading={busy === `open-${c.id}`}>Get download link</Button>
                  )}
                  {reviewing && c.downloadable ? (
                    <>
                      <TextField label="Note to the doctor" hint="Needed when rejecting" value={notes[c.id] ?? ''} onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })} />
                      <Button onClick={() => void decide(c, 'ACCEPTED')} loading={busy === `ACCEPTED-${c.id}`}>Accept</Button>
                      <Button variant="danger" onClick={() => void decide(c, 'REJECTED')} loading={busy === `REJECTED-${c.id}`}>Reject</Button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {reviewing ? (
        <div className="grid-2">
          <Card title="Verify">
            <form className="stack" onSubmit={verify}>
              <p className="muted">Needs an accepted PRC ID. The doctor is notified. You will be asked for an authenticator code.</p>
              <TextField label="Note for the audit log (optional)" value={verifyReason} onChange={(e) => setVerifyReason(e.target.value)} />
              <div><Button type="submit" loading={busy === 'verify'}>Verify doctor</Button></div>
            </form>
          </Card>
          <Card title="Send back">
            <form className="stack" onSubmit={reject}>
              <TextField label="Reason shown to the doctor" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} error={fieldError(actionError, 'reason')} required minLength={5} />
              <label className="check"><input type="checkbox" checked={moreDocuments} onChange={(e) => setMoreDocuments(e.target.checked)} /> Ask for more documents rather than reject</label>
              <div><Button type="submit" variant="danger" loading={busy === 'reject'}>Send back to doctor</Button></div>
            </form>
          </Card>
        </div>
      ) : null}

      {status === 'VERIFIED' ? (
        <Card title="Activate">
          <p className="muted">An active doctor can be listed and booked once their services and schedules are set up. You will be asked for an authenticator code.</p>
          <div><Button onClick={() => void activate()} loading={busy === 'activate'}>Activate doctor</Button></div>
        </Card>
      ) : null}

      <Card title="History">
        <ol className="history">
          {doctor.verification_history.map((e, i) => (
            <li key={`${e.occurred_at}-${i}`}>
              <span>{ONBOARDING_LABELS[e.to_status] ?? e.to_status}</span> <span className="muted small">{formatDateTime(e.occurred_at)}</span>
              {e.reason ? <p className="small">{e.reason}</p> : null}
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}
