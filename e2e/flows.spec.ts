import { expect, test } from '@playwright/test';
import { DOCTOR_ID, mockApi, users } from './helpers';

test('sign in: wrong password, then password and authenticator code', async ({ page }) => {
  await mockApi(page, { session: 'signedOut' });
  await page.goto('/sign-in');
  await page.getByLabel('Email or mobile number').fill('admin@example.test', { timeout: 60_000 });
  await page.getByLabel('Password').fill('wrong-password-1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('The credentials are incorrect.')).toBeVisible();

  await page.getByLabel('Password').fill('Correct-horse-42');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Two-step verification' })).toBeVisible();

  await page.getByLabel('6-digit code').fill('000000');
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByText('The code is incorrect or has expired.')).toBeVisible();

  await page.getByLabel('6-digit code').fill('123456');
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
});

test('MFA setup shows the key, confirms, then shows recovery codes once', async ({ page }) => {
  await mockApi(page, { session: 'mfaSetup' });
  await page.goto('/mfa/setup');
  await expect(page.getByLabel('Setup key')).toHaveText('JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP', { timeout: 60_000 });
  await page.getByLabel('6-digit code').fill('123456');
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByRole('heading', { name: 'Save your recovery codes' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Recovery codes' }).getByRole('listitem')).toHaveCount(4);
  await page.getByRole('button', { name: 'I have saved them, continue' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
});

test('suspending asks for a reason, then a fresh authenticator code, then retries', async ({ page }) => {
  await mockApi(page, { stepUpFirst: true });
  await page.goto(`/users/${users[0].id}`);
  await page.getByLabel('Reason').fill('Reported abuse, ticket 123', { timeout: 60_000 });
  const attempts: string[] = [];
  page.on('request', (r) => { if (r.url().endsWith('/suspend')) attempts.push(r.method()); });
  await page.getByRole('button', { name: 'Suspend account' }).click();

  const dialog = page.getByRole('dialog', { name: 'Confirm it is you' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('6-digit code').fill('123456');
  await dialog.getByRole('button', { name: 'Verify' }).click();

  await expect(page.getByText('The account was suspended and signed out everywhere.')).toBeVisible();
  await expect(page.getByText('Suspended', { exact: true })).toBeVisible();
  expect(attempts).toEqual(['POST', 'POST']); // refused once, retried after step-up
});

test('cancelling the step-up leaves the account unchanged', async ({ page }) => {
  await mockApi(page, { stepUpFirst: true });
  await page.goto(`/users/${users[0].id}`);
  await page.getByLabel('Reason').fill('Reported abuse, ticket 123', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Suspend account' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Verification cancelled. Nothing was changed.')).toBeVisible();
  await expect(page.getByText('Active', { exact: true })).toBeVisible();
});

test('an ADMIN sees no role editor (roles are SUPER_ADMIN only)', async ({ page }) => {
  await mockApi(page);
  await page.goto(`/users/${users[0].id}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Ana Santos' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('group', { name: 'Roles this account holds' })).toHaveCount(0);
});

test('users table filters send only known filters', async ({ page }) => {
  await mockApi(page);
  await page.goto('/users');
  await expect(page.getByRole('table')).toBeVisible({ timeout: 60_000 });
  await page.getByLabel('Search', { exact: true }).fill('ana');
  await page.getByLabel('Status').selectOption('SUSPENDED');
  const request = page.waitForRequest((r) => r.url().includes('/api/v1/admin/users?'));
  await page.getByRole('button', { name: 'Apply filters' }).click();
  const url = new URL((await request).url());
  expect(url.searchParams.get('filter[search]')).toBe('ana');
  expect(url.searchParams.get('filter[status]')).toBe('SUSPENDED');
  expect(url.searchParams.has('filter[role]')).toBe(false);
});

test('settings: invalid JSON is caught before sending; saving needs step-up', async ({ page }) => {
  await mockApi(page, { stepUpFirst: true });
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Edit booking.max_days_ahead' }).click({ timeout: 60_000 });
  await page.getByLabel('Value (JSON)').fill('sixty');
  await page.getByLabel('Reason').fill('Longer booking window');
  await page.getByRole('button', { name: 'Save setting' }).click();
  await expect(page.getByText(/Enter the value as JSON/)).toBeVisible();

  await page.getByLabel('Value (JSON)').fill('90');
  await page.getByRole('button', { name: 'Save setting' }).click();
  await page.getByRole('dialog').getByLabel('6-digit code').fill('123456');
  await page.getByRole('dialog').getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByText('Saved booking.max_days_ahead.')).toBeVisible();
});

test('sign out returns to the sign-in page', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign out' }).click({ timeout: 60_000 });
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('specialties: medical admins see pending entries, add one, and mark one reviewed', async ({ page }) => {
  await mockApi(page, { roles: ['MEDICAL_ADMIN'] });
  await page.goto('/specialties');
  await expect(page.getByText('1 seeded entry is waiting for medical review.', { exact: false })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('link', { name: 'Specialties' })).toHaveAttribute('aria-current', 'page');

  await page.getByLabel('Name', { exact: true }).fill('Sports Medicine');
  await page.getByLabel('Synonyms (comma-separated)').first().fill('sports doctor, sports physician');
  const create = page.waitForRequest((r) => r.url().endsWith('/api/v1/admin/specialties') && r.method() === 'POST');
  await page.getByRole('button', { name: 'Add specialty' }).click();
  expect((await create).postDataJSON()).toEqual({ name: 'Sports Medicine', synonyms: ['sports doctor', 'sports physician'] });

  const review = page.waitForRequest((r) => r.method() === 'PATCH');
  await page.getByRole('button', { name: 'Mark Cardiology as reviewed' }).click();
  expect((await review).postDataJSON()).toEqual({ reviewed: true });
  await expect(page.getByText('Cardiology marked as reviewed.')).toBeVisible();
});

test('an ADMIN has no Specialties entry in the navigation', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('link', { name: 'Specialties' })).toHaveCount(0);
});

test('a clinic manager lands on their clinics, edits weekly hours and adds staff', async ({ page }) => {
  await mockApi(page, { roles: ['CLINIC_MANAGER'] });
  await page.goto('/');
  await expect(page).toHaveURL(/\/clinics$/, { timeout: 60_000 });
  await expect(page.getByText('The clinics you work at.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Santos Family Clinic' }).click();

  await expect(page.getByText('Mon 08:00–12:00, 13:00–17:00')).toBeVisible();
  await page.getByRole('button', { name: 'Edit hours for Makati branch' }).click();
  await page.getByRole('button', { name: 'Add hours' }).click();
  const rows = page.locator('.hours__row');
  await rows.nth(2).getByLabel('Day', { exact: true }).selectOption('6');
  await rows.nth(2).getByLabel('Opens', { exact: true }).fill('09:00');
  await rows.nth(2).getByLabel('Closes', { exact: true }).fill('12:00');
  const put = page.waitForRequest((r) => r.method() === 'PUT');
  await page.getByRole('button', { name: 'Save hours' }).click();
  expect(((await put).postDataJSON() as { hours: unknown[] }).hours).toEqual([
    { day_of_week: 1, opens_at: '08:00', closes_at: '12:00' },
    { day_of_week: 1, opens_at: '13:00', closes_at: '17:00' },
    { day_of_week: 6, opens_at: '09:00', closes_at: '12:00' },
  ]);
  await expect(page.getByText('Hours saved for Makati branch.')).toBeVisible();

  await page.getByLabel('Email of their MediConnect account').fill('nobody@example.test');
  await page.getByRole('button', { name: 'Add staff member' }).click();
  await expect(page.getByText(/No active MediConnect account uses this address/)).toBeVisible();
  await page.getByLabel('Email of their MediConnect account').fill('dan.lim@example.test');
  await page.getByLabel('Role', { exact: true }).selectOption('CLINIC_MANAGER');
  await page.getByRole('button', { name: 'Add staff member' }).click();
  await expect(page.getByText('Dan Lim')).toBeVisible();
});

test('clinic staff see the clinic read-only', async ({ page }) => {
  await mockApi(page, { roles: ['CLINIC_STAFF'] });
  await page.goto('/clinics/01a1ec01-0000-7000-8000-00000000c001');
  await expect(page.getByText('You can view this clinic. Changes are made by its managers.')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('button', { name: /Edit hours/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add staff member' })).toHaveCount(0);
});

test('an ADMIN adds a clinic with its organization and first location', async ({ page }) => {
  await mockApi(page);
  await page.goto('/clinics');
  await page.getByRole('button', { name: 'Add a clinic' }).click({ timeout: 60_000 });
  await page.getByLabel('Organization name').fill('Reyes Health');
  await page.getByLabel('Clinic name').fill('Reyes Clinic');
  await page.getByLabel('First location name').fill('Quezon City branch');
  await page.getByLabel('Street address').fill('5 Kalayaan Ave');
  await page.getByLabel('City').fill('Quezon City');
  const post = page.waitForRequest((r) => r.url().endsWith('/api/v1/admin/clinics') && r.method() === 'POST');
  await page.getByRole('button', { name: 'Create clinic' }).click();
  expect((await post).postDataJSON()).toEqual({
    organization: { name: 'Reyes Health', organization_type: 'CLINIC_GROUP' },
    name: 'Reyes Clinic',
    location: { name: 'Quezon City branch', address_line1: '5 Kalayaan Ave', city: 'Quezon City', phone: null },
  });
});

test('a medical admin reviews a doctor: start, accept the PRC ID, then verify after a fresh code', async ({ page }) => {
  await mockApi(page, { roles: ['MEDICAL_ADMIN'], stepUpFirst: true });
  await page.goto(`/doctors/${DOCTOR_ID}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Dr. Ana Reyes' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Blocked: malware found')).toBeVisible();

  await expect(page.getByRole('button', { name: 'Get download link' }).nth(1)).toBeDisabled(); // quarantined
  await page.getByRole('button', { name: 'Get download link' }).first().click();
  await expect(page.getByRole('link', { name: 'Download PRC ID' })).toHaveAttribute('href', /signature=/);

  await page.getByRole('button', { name: 'Start review' }).click();
  await expect(page.getByText('Review started. Check each document, then decide.')).toBeVisible();
  await page.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(page.getByText('Document accepted.')).toBeVisible();

  await page.getByLabel('Reason for the audit log').fill('Licence checked on the register');
  await page.getByRole('button', { name: 'Verify doctor' }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirm it is you' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('6-digit code').fill('123456');
  await dialog.getByRole('button', { name: 'Verify', exact: true }).click();
  await expect(page.getByText('Verified. The doctor was notified.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Activate doctor' })).toBeVisible();
});
