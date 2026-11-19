import { expect, test } from '@playwright/test';
import { mockApi, users } from './helpers';

/**
 * WIP screenshots of the real running admin console (mocked API fixtures only,
 * no real data). Run: pnpm e2e:wip  -> ../docs/wip-screenshots/
 */
const PHASE = 'phase-2';
const shots = [
  { feature: 'admin', name: 'admin-sign-in', path: '/sign-in', heading: 'MediConnect Console', session: 'signedOut' as const },
  { feature: 'admin', name: 'admin-mfa-setup', path: '/mfa/setup', heading: 'Set up two-step verification', session: 'mfaSetup' as const },
  { feature: 'admin', name: 'admin-overview', path: '/', heading: 'Overview' },
  { feature: 'admin', name: 'admin-users', path: '/users', heading: 'Users' },
  { feature: 'admin', name: 'admin-user-detail', path: `/users/${users[0].id}`, heading: 'Ana Santos' },
  { feature: 'admin', name: 'admin-audit-logs', path: '/audit-logs', heading: 'Audit logs' },
  { feature: 'admin', name: 'admin-settings', path: '/settings', heading: 'Settings' },
  { feature: 'admin', name: 'admin-specialties', path: '/specialties', heading: 'Specialties', roles: ['MEDICAL_ADMIN'] },
];

for (const s of shots) {
  test(`wip shot: ${s.name}`, async ({ page }, info) => {
    test.skip(!process.env.WIP_SHOTS, 'set WIP_SHOTS=1 (pnpm e2e:wip) to capture');
    await mockApi(page, { session: 'session' in s ? s.session : 'signedIn', roles: 'roles' in s ? s.roles : undefined });
    await page.goto(s.path);
    await expect(page.getByRole('heading', { level: 1, name: s.heading })).toBeVisible({ timeout: 60_000 });
    await page.screenshot({ path: `${info.config.rootDir}/../../docs/wip-screenshots/${PHASE}/${s.feature}/${s.name}-${info.project.name}.png`, fullPage: true });
  });
}
