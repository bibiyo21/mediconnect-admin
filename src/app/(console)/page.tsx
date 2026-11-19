'use client';

import { Card, PageHeader, StateMessage } from '@/components/ui';
import { api, unwrap, userMessage } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';

export default function Overview() {
  const { data, error, loading, reload } = useLoad(async () => unwrap(await api.GET('/admin/overview')), []);

  return (
    <>
      <PageHeader title="Overview" description="Platform totals. No personal data is shown here." />
      {loading && !data ? <StateMessage state="loading" message="Loading totals" /> : null}
      {error ? <StateMessage state="error" message={userMessage(error)} onRetry={reload} /> : null}
      {data ? (
        <div className="stats">
          <Card title="Accounts"><p className="stat">{data.users.total}</p><p className="muted">{data.users.active} active · {data.users.suspended} suspended</p></Card>
          <Card title="Pending deletion"><p className="stat">{data.users.pending_deletion}</p><p className="muted">Within the 30-day grace period</p></Card>
          <Card title="Patients"><p className="stat">{data.patients}</p><p className="muted">{data.dependents} family members managed by guardians</p></Card>
          <Card title="Security events"><p className="stat">{data.security_events_24h}</p><p className="muted">In the last 24 hours</p></Card>
        </div>
      ) : null}
    </>
  );
}
