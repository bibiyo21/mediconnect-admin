'use client';

import { useState, type FormEvent } from 'react';
import { Button, PageHeader, Pagination, StateMessage, TextField } from '@/components/ui';
import { api, formatDateTime, unwrap, userMessage } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';

type Filters = { action: string; subject_id: string; from: string; to: string };
const EMPTY: Filters = { action: '', subject_id: '', from: '', to: '' };

export default function AuditLogs() {
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);

  const { data, error, loading, reload } = useLoad(async () => {
    const query: Record<string, string | number> = { page, per_page: 50 };
    for (const [k, v] of Object.entries(filters)) if (v.trim()) query[`filter[${k}]`] = v.trim();
    const result = await api.GET('/admin/audit-logs', { params: { query: query as never } });
    return { rows: unwrap(result) as AuditRow[], meta: (result.data as { meta?: { page: number; last_page: number; total: number } } | undefined)?.meta };
  }, [filters, page]);

  const apply = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setFilters(draft);
  };

  return (
    <>
      <PageHeader title="Audit logs" description="Who changed what, newest first. Values are recorded without secrets." />
      <form className="filters" onSubmit={apply} role="search" aria-label="Filter audit logs">
        <TextField label="Action" placeholder="user.suspended" value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })} />
        <TextField label="Subject ID" value={draft.subject_id} onChange={(e) => setDraft({ ...draft, subject_id: e.target.value })} />
        <TextField label="From" type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
        <TextField label="To" type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
        <Button type="submit" variant="secondary">Apply filters</Button>
      </form>

      {loading && !data ? <StateMessage state="loading" message="Loading audit logs" /> : null}
      {error ? <StateMessage state="error" message={userMessage(error)} onRetry={reload} /> : null}
      {data && data.rows.length === 0 ? <StateMessage state="empty" message="No audit entries match these filters." /> : null}
      {data && data.rows.length > 0 ? (
        <>
          <div className="table-wrap" role="region" aria-label="Audit log table" tabIndex={0}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Action</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Subject</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="nowrap">{formatDateTime(r.occurred_at)}</td>
                    <td><code>{r.action}</code>{r.is_access_event ? ' (read)' : ''}</td>
                    <td className="mono small">{r.actor_user_id ?? 'system'}{r.actor_roles ? <span className="muted"> · {r.actor_roles}</span> : null}</td>
                    <td className="mono small">{r.subject_type ? `${r.subject_type} ${r.subject_id ?? ''}` : '—'}</td>
                    <td className="mono small">{r.changes ? JSON.stringify(r.changes) : '—'}</td>
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

interface AuditRow {
  id: number;
  occurred_at: string;
  actor_user_id: string | null;
  actor_roles: string | null;
  action: string;
  subject_type: string | null;
  subject_id: string | null;
  changes: unknown;
  is_access_event: boolean;
}
