'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { CONSOLE_ROLES, hasRole, useSession } from '@/lib/session';
import { StepUpProvider } from './StepUp';
import { Button, StateMessage } from './ui';

const NAV = [
  { href: '/', label: 'Overview', roles: ['SUPER_ADMIN', 'ADMIN', 'MEDICAL_ADMIN', 'SUPPORT_AGENT'] },
  { href: '/users', label: 'Users', roles: ['SUPER_ADMIN', 'ADMIN', 'MEDICAL_ADMIN', 'SUPPORT_AGENT'] },
  { href: '/specialties', label: 'Specialties', roles: ['SUPER_ADMIN', 'MEDICAL_ADMIN'] },
  { href: '/audit-logs', label: 'Audit logs', roles: ['SUPER_ADMIN', 'ADMIN', 'MEDICAL_ADMIN'] },
  { href: '/settings', label: 'Settings', roles: ['SUPER_ADMIN', 'ADMIN'] },
];

/** Signed-in console frame. Navigation hides what a role cannot use; the API enforces it regardless. */
export function ConsoleShell({ children }: { children: ReactNode }) {
  const { status, account, signOut } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'signedOut') router.replace('/sign-in');
    if (status === 'mfaSetupRequired') router.replace('/mfa/setup');
  }, [status, router]);

  if (status !== 'signedIn' || !account) {
    return <main id="content" className="centered"><StateMessage state="loading" message="Checking your sign-in" /></main>;
  }

  if (!hasRole(account, ...CONSOLE_ROLES)) {
    return (
      <main id="content" className="centered stack">
        <h1>No access</h1>
        <p>This account does not have a role that can use the MediConnect console.</p>
        <Button variant="secondary" onClick={() => void signOut()}>Sign out</Button>
      </main>
    );
  }

  const items = NAV.filter((n) => hasRole(account, ...n.roles));
  return (
    <StepUpProvider>
      <div className="console">
        <header className="console__header">
          <span className="console__brand">MediConnect <span className="muted">Console</span></span>
          <nav aria-label="Main" className="console__nav">
            {items.map((n) => {
              const current = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} aria-current={current ? 'page' : undefined} className={current ? 'nav-link nav-link--current' : 'nav-link'}>
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="console__account">
            <span className="muted" title={account.roles.join(', ')}>{account.email ?? account.mobile_masked}</span>
            <Button variant="ghost" onClick={() => void signOut()}>Sign out</Button>
          </div>
        </header>
        <main id="content" className="console__main">{children}</main>
      </div>
    </StepUpProvider>
  );
}
