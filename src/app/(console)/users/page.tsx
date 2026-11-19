'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button, PageHeader, Pagination, SelectField, StateMessage, TextField } from '@/components/ui';
import { ROLES, StatusBadge } from '@/components/users';
import { api, formatDateTime, unwrap, userMessage } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';

type Filters = { search: string; status: string; role: string };

export default function Users() {
  const [draft, setDraft] = useState<Filters>({ search: '', status: '', role: '' });
  const [filters, setFilters] = useState<Filters>(draft);
  const [page, setPage] = useState(1);

  const { data, error, loading, reload } = useLoad(async () => {
    const filter: Record<string, string> = {};
    if (filters.search.trim().length >= 2) filter.search = filters.search.trim();
    if (filters.status) filter.status = filters.status;
    if (filters.role) filter.role = filters.role;
    const query = { page, per_page: 25, ...Object.fromEntries(Object.entries(filter).map(([k, v]) => [`filter[${k}]`, v])) };
    const result = await api.GET('/admin/users', { params: { query: query as never } });
    return { users: unwrap(result), meta: (result.data as { meta?: { page: number; last_page: number; total: number } } | undefined)?.meta };
  }, [filters, page]);

  const apply = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setFilters(draft);
  };

  return (
    <>
      <PageHeader title="Users" description="Accounts and their roles. Medical information is never shown here." />
      <form className="filters" onSubmit={apply} role="search" aria-label="Filter users">
        <TextField label="Search" aria-describedby="user-search-help" value={draft.search} onChange={(e) => setDraft({ ...draft, search: e.target.value })} />
        <SelectField label="Status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
          <option value="">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="DEACTIVATED">Deactivated</option>
        </SelectField>
        <SelectField label="Role" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
          <option value="">Any role</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </SelectField>
        <Button type="submit" variant="secondary">Apply filters</Button>
        <p id="user-search-help" className="muted small filters__help">Search matches the start of an email address, or the last 4 or more digits of a mobile number.</p>
      </form>

      {loading && !data ? <StateMessage state="loading" message="Loading users" /> : null}
      {error ? <StateMessage state="error" message={userMessage(error)} onRetry={reload} /> : null}
      {data && data.users.length === 0 ? <StateMessage state="empty" message="No accounts match these filters." /> : null}
      {data && data.users.length > 0 ? (
        <>
          <div className="table-wrap" role="region" aria-label="Users table" tabIndex={0}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Mobile</th>
                  <th scope="col">Roles</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last sign-in</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id}>
                    <td><Link href={`/users/${u.id}`}>{[u.first_name, u.last_name].filter(Boolean).join(' ') || 'No name'}</Link></td>
                    <td>{u.email ?? '—'}</td>
                    <td>{u.mobile_masked ?? '—'}</td>
                    <td>{u.roles.join(', ') || '—'}</td>
                    <td><StatusBadge user={u} /></td>
                    <td>{formatDateTime(u.last_login_at)}</td>
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
