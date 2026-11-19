'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Badge, Button, PageHeader, Pagination, SelectField, StateMessage, TextField } from '@/components/ui';
import { api, formatDateTime, unwrap, userMessage } from '@/lib/api';
import { ONBOARDING_LABELS, ONBOARDING_TONES } from '@/lib/doctors';
import { useLoad } from '@/lib/useLoad';

type Filters = { search: string; status: string };

/** Doctor verification queue (increment 2.9). Oldest submission first. */
export default function DoctorQueue() {
  const [draft, setDraft] = useState<Filters>({ search: '', status: '' });
  const [filters, setFilters] = useState<Filters>(draft);
  const [page, setPage] = useState(1);

  const { data, error, loading, reload } = useLoad(async () => {
    const query: Record<string, string | number> = { page, per_page: 25 };
    if (filters.search.trim().length >= 2) query['filter[search]'] = filters.search.trim();
    if (filters.status) query['filter[onboarding_status]'] = filters.status;
    const result = await api.GET('/admin/doctors', { params: { query: query as never } });
    return { rows: unwrap(result), meta: (result.data as { meta?: { page: number; last_page: number; total: number } } | undefined)?.meta };
  }, [filters, page]);

  const apply = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setFilters(draft);
  };

  return (
    <>
      <PageHeader title="Doctor verification" description="Applications waiting for a licence and document check, oldest first." />
      <form className="filters" onSubmit={apply} role="search" aria-label="Filter applications">
        <TextField label="Search" hint="Start of the doctor's display name" value={draft.search} onChange={(e) => setDraft({ ...draft, search: e.target.value })} />
        <SelectField label="Status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
          <option value="">Waiting or under review</option>
          {Object.entries(ONBOARDING_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </SelectField>
        <Button type="submit" variant="secondary">Apply filters</Button>
      </form>

      {loading && !data ? <StateMessage state="loading" message="Loading applications" /> : null}
      {error ? <StateMessage state="error" message={userMessage(error)} onRetry={reload} /> : null}
      {data && data.rows.length === 0 ? <StateMessage state="empty" message="No applications match. New submissions appear here." /> : null}
      {data && data.rows.length > 0 ? (
        <>
          <div className="table-wrap" role="region" aria-label="Applications table" tabIndex={0}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Doctor</th>
                  <th scope="col">Status</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Documents</th>
                  <th scope="col">Profile</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((d) => (
                  <tr key={d.id}>
                    <td><Link href={`/doctors/${d.id}`}>{d.display_name}</Link>{d.professional_title ? <span className="muted">, {d.professional_title}</span> : null}</td>
                    <td><Badge tone={ONBOARDING_TONES[d.onboarding_status] ?? 'neutral'}>{ONBOARDING_LABELS[d.onboarding_status] ?? d.onboarding_status}</Badge></td>
                    <td>{formatDateTime(d.submitted_at)}</td>
                    <td>{d.document_count}</td>
                    <td>{d.profile_completeness}% complete</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.meta ? <Pagination page={data.meta.page} lastPage={data.meta.last_page} total={data.meta.total} onPage={setPage} /> : null}
        </>
      ) : null}
    </>
  );
}
