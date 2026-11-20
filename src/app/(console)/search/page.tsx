'use client';

import { useState, type FormEvent } from 'react';
import { Badge, Button, Card, Notice, PageHeader, StateMessage, TextField } from '@/components/ui';
import { api, fieldError, formatDateTime, prepareWrites, unwrap, userMessage } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';

type Overview = { days: number; searches: number; zero_result_rate: number; cache_hit_rate: number; degraded_rate: number; latency_ms: { p50: number | null; p95: number | null; p99: number | null }; top_queries: { query: string; searches: number }[]; open_zero_results: number };
type ZeroResult = { id: string; query: string; collection: string; occurrences: number; first_seen_at: string; last_seen_at: string; status: string };
type Synonym = { id: string; synonyms: string[]; root_term: string | null; status: string; updated_at: string };

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const splitTerms = (text: string) => text.split(',').map((t) => t.trim()).filter(Boolean);

/**
 * Search curation (D-42, increment 3.4): how search is doing, queries that
 * found nothing, and the synonyms that help them. Analytics hold no identity.
 */
export default function SearchCuration() {
  const overview = useLoad(async () => unwrap(await api.GET('/admin/search/overview', {})) as unknown as Overview, []);
  const zero = useLoad(async () => unwrap(await api.GET('/admin/search/zero-results', {})) as unknown as ZeroResult[], []);
  const synonyms = useLoad(async () => unwrap(await api.GET('/admin/search/synonyms', {})) as unknown as Synonym[], []);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState<string | null>(null);
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [newTerms, setNewTerms] = useState('');

  const run = async (key: string, message: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    setDone(null);
    try {
      await prepareWrites();
      await fn();
      setDone(message);
      zero.reload();
      synonyms.reload();
      overview.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  const addFromZero = (z: ZeroResult) => run(`add-${z.id}`, `Synonym added for "${z.query}". Search uses it from now on.`, async () =>
    unwrap(await api.POST('/admin/search/synonyms', { body: { synonyms: [z.query, ...splitTerms(extra[z.id] ?? '')], zero_result_id: z.id } })));
  const ignore = (z: ZeroResult) => run(`ignore-${z.id}`, `"${z.query}" ignored.`, async () =>
    unwrap(await api.POST('/admin/search/zero-results/{zeroResultId}/ignore', { params: { path: { zeroResultId: z.id } } })));
  const deactivate = (s: Synonym) => run(`off-${s.id}`, 'Synonym turned off.', async () =>
    unwrap(await api.PATCH('/admin/search/synonyms/{synonymId}', { params: { path: { synonymId: s.id } }, body: { status: 'INACTIVE' } })));
  const create = (event: FormEvent) => {
    event.preventDefault();
    void run('create', 'Synonym added.', async () => {
      unwrap(await api.POST('/admin/search/synonyms', { body: { synonyms: splitTerms(newTerms) } }));
      setNewTerms('');
    });
  };

  const o = overview.data;
  return (
    <>
      <PageHeader title="Search" description="How patients search, what they could not find, and the synonyms that help. No patient identity is stored." />
      {done ? <Notice tone="success">{done}</Notice> : null}
      {error && !fieldError(error, 'synonyms') ? <Notice tone="error">{userMessage(error)}</Notice> : null}

      <Card title={`Last ${o?.days ?? 7} days`}>
        {overview.loading && !o ? <StateMessage state="loading" message="Loading search metrics" /> : null}
        {overview.error ? <StateMessage state="error" message={userMessage(overview.error)} onRetry={overview.reload} /> : null}
        {o ? (
          <>
            <dl className="details">
              <dt>Searches</dt><dd>{o.searches}</dd>
              <dt>Found nothing</dt><dd>{pct(o.zero_result_rate)}</dd>
              <dt>Answered from cache</dt><dd>{pct(o.cache_hit_rate)}</dd>
              <dt>Answered by the fallback</dt><dd>{pct(o.degraded_rate)}</dd>
              <dt>Response time (P50 / P95 / P99)</dt><dd>{o.latency_ms.p50 ?? '—'} / {o.latency_ms.p95 ?? '—'} / {o.latency_ms.p99 ?? '—'} ms</dd>
            </dl>
            {o.top_queries.length ? <p className="muted small">Top searches: {o.top_queries.map((t) => `${t.query} (${t.searches})`).join(', ')}</p> : null}
          </>
        ) : null}
      </Card>

      <Card title="Searches that found nothing">
        {zero.loading && !zero.data ? <StateMessage state="loading" message="Loading the queue" /> : null}
        {zero.error ? <StateMessage state="error" message={userMessage(zero.error)} onRetry={zero.reload} /> : null}
        {zero.data && zero.data.length === 0 ? <StateMessage state="empty" message="Nothing waiting. New queries appear here when a search finds no doctors or clinics." /> : null}
        {zero.data && zero.data.length > 0 ? (
          <ul className="doc-list">
            {zero.data.map((z) => (
              <li key={z.id} className="doc">
                <div className="doc__head">
                  <div>
                    <p className="doc__title">&ldquo;{z.query}&rdquo;</p>
                    <p className="muted small">{z.occurrences} {z.occurrences === 1 ? 'search' : 'searches'} · {z.collection} · last {formatDateTime(z.last_seen_at)}</p>
                  </div>
                </div>
                <div className="doc__actions">
                  <TextField label={`Same meaning as "${z.query}"`} hint="Comma-separated, for example: cardiology, cardiologist" value={extra[z.id] ?? ''} onChange={(e) => setExtra({ ...extra, [z.id]: e.target.value })} />
                  <Button onClick={() => void addFromZero(z)} disabled={splitTerms(extra[z.id] ?? '').length === 0} loading={busy === `add-${z.id}`}>Add synonym</Button>
                  <Button variant="secondary" onClick={() => void ignore(z)} loading={busy === `ignore-${z.id}`}>Ignore</Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card title="Synonyms">
        <form className="filters" onSubmit={create}>
          <TextField label="New synonym group" hint="Terms that should find each other, comma-separated" value={newTerms} onChange={(e) => setNewTerms(e.target.value)} error={fieldError(error, 'synonyms')} />
          <Button type="submit" variant="secondary" disabled={splitTerms(newTerms).length < 2} loading={busy === 'create'}>Add group</Button>
        </form>
        {synonyms.loading && !synonyms.data ? <StateMessage state="loading" message="Loading synonyms" /> : null}
        {synonyms.data ? (
          <ul className="settings-list">
            {synonyms.data.map((s) => (
              <li key={s.id}>
                <span>{s.synonyms.join(' · ')} {s.root_term ? <Badge tone="info">One-way from {s.root_term}</Badge> : null}</span>
                <Button variant="ghost" onClick={() => void deactivate(s)} loading={busy === `off-${s.id}`} aria-label={`Turn off ${s.synonyms[0]}`}>Turn off</Button>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </>
  );
}
