import { expect, test } from '@playwright/test';
import { mockApi, users } from './helpers';

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
