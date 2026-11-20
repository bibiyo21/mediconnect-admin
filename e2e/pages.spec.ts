import { expect, test } from '@playwright/test';
import { DOCTOR_ID, axeViolations, expectNoHorizontalScroll, mockApi, users } from './helpers';

const pages: { path: string; heading: string; session?: 'signedIn' | 'signedOut' | 'mfaSetup'; roles?: string[] }[] = [
  { path: '/sign-in', heading: 'MediConnect Console', session: 'signedOut' as const },
  { path: '/mfa/setup', heading: 'Set up two-step verification', session: 'mfaSetup' as const },
  { path: '/', heading: 'Overview' },
  { path: '/users', heading: 'Users' },
  { path: `/users/${users[0].id}`, heading: 'Ana Santos' },
  { path: '/audit-logs', heading: 'Audit logs' },
  { path: '/settings', heading: 'Settings' },
  { path: '/specialties', heading: 'Specialties', roles: ['MEDICAL_ADMIN'] },
  { path: '/doctors', heading: 'Doctor verification', roles: ['MEDICAL_ADMIN'] },
  { path: `/doctors/${DOCTOR_ID}`, heading: 'Dr. Ana Reyes', roles: ['MEDICAL_ADMIN'] },
  { path: '/search', heading: 'Search', roles: ['MEDICAL_ADMIN'] },
  { path: '/clinics', heading: 'Clinics' },
  { path: '/clinics/01a1ec01-0000-7000-8000-00000000c001', heading: 'Santos Family Clinic' },
  { path: '/clinics/01a1ec01-0000-7000-8000-00000000c001', heading: 'Santos Family Clinic', roles: ['CLINIC_STAFF'] },
];

for (const p of pages) {
  test.describe(p.roles ? `${p.path} as ${p.roles.join(", ")}` : p.path, () => {
    test.beforeEach(async ({ page }) => {
      await mockApi(page, { session: p.session ?? 'signedIn', roles: p.roles });
      await page.goto(p.path);
      await expect(page.getByRole('heading', { level: 1, name: p.heading })).toBeVisible({ timeout: 60_000 });
    });

    test('one h1, a skip link and no horizontal scroll', async ({ page }) => {
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('link', { name: 'Skip to content' })).toBeAttached();
      await expectNoHorizontalScroll(page);
    });

    test('has no detectable WCAG 2.2 AA violations', async ({ page }) => {
      expect(await axeViolations(page)).toEqual([]);
    });
  });
}

test('signed-out visitors are sent to sign in', async ({ page }) => {
  await mockApi(page, { session: 'signedOut' });
  await page.goto('/users');
  await expect(page).toHaveURL(/\/sign-in$/, { timeout: 60_000 });
});

test('the current section is marked in the navigation', async ({ page }) => {
  await mockApi(page);
  await page.goto('/audit-logs');
  await expect(page.getByRole('link', { name: 'Audit logs' })).toHaveAttribute('aria-current', 'page', { timeout: 60_000 });
});
