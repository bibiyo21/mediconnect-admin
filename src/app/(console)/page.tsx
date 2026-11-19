'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, PageHeader, StateMessage } from '@/components/ui';
import { api, unwrap, userMessage } from '@/lib/api';
import { ADMIN_ROLES, hasRole, useSession } from '@/lib/session';
import { useLoad } from '@/lib/useLoad';

export default function Overview() {
  const router = useRouter();
  const { account } = useSession();
  const isAdmin = hasRole(account, ...ADMIN_ROLES);
  // Clinic managers and staff work inside their clinics; send them there.
  useEffect(() => {
    if (account && !isAdmin) router.replace('/clinics');
  }, [account, isAdmin, router]);
  const { data, error, loading, reload } = useLoad(async () => (isAdmin ? unwrap(await api.GET('/admin/overview')) : null), [isAdmin]);

  return (
    <>
      <PageHeader title="Overview" description="Platform totals. No personal data is shown here." />
      {loading && !data ? <StateMessage state="loading" message="Loading totals" /> : null}
      {error ? <StateMessage state="error" message={userMessage(error)} onRetry={reload} /> : null}
      {data ? (
        <div className="stats">
          <Card title="Accounts"><p className="stat">{data.users.total}</p><p className="muted">{data.users.active} active · {data.users.suspended} suspended</p></Card>
          <Card title="Pending deletion"><p className="stat">{data.users.pending_deletion}</p><p className="muted">Within the 30-day grace period</p></Card>
          <Card title="Patients"><p className="stat">{data.patients}</p><p className="muted">{data.dependents} {data.dependents === 1 ? 'family member' : 'family members'} managed by guardians</p></Card>
          <Card title="Security events"><p className="stat">{data.security_events_24h}</p><p className="muted">In the last 24 hours</p></Card>
        </div>
      ) : null}
    </>
  );
}
