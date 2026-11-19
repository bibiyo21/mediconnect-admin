import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type Route } from '@playwright/test';

/** WCAG 2.2 AA scan; returns readable violation ids. */
export async function axeViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

const json = (status: number, body: unknown) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const ok = (data: unknown, meta: unknown = {}) => json(200, { success: true, data, meta, message: null });
const fail = (status: number, code: string, message: string, errors: Record<string, string[]> = {}) => json(status, { success: false, message, errors, code, request_id: null });

export const admin = {
  id: '01a1ec01-0000-7000-8000-00000000a001', email: 'admin@example.test', mobile_masked: null, email_verified: true, mobile_verified: false,
  status: 'ACTIVE', locale: 'en', roles: ['ADMIN'], profile: { first_name: 'Ada', middle_name: null, last_name: 'Admin' },
};

export const users = [
  { id: '01a1ec01-0000-7000-8000-00000000b001', email: 'ana.santos@example.test', mobile_masked: '+63 9•• ••• 4567', status: 'ACTIVE', roles: ['PATIENT'], first_name: 'Ana', last_name: 'Santos', mfa_enrolled: false, deletion_requested_at: null, last_login_at: '2026-11-18T01:00:00Z', created_at: '2026-11-17T01:00:00Z' },
  { id: '01a1ec01-0000-7000-8000-00000000b002', email: 'ben.cruz@example.test', mobile_masked: null, status: 'SUSPENDED', roles: ['PATIENT'], first_name: 'Ben', last_name: 'Cruz', mfa_enrolled: false, deletion_requested_at: null, last_login_at: null, created_at: '2026-11-16T01:00:00Z' },
  { id: '01a1ec01-0000-7000-8000-00000000b003', email: 'clinic.staff@example.test', mobile_masked: null, status: 'ACTIVE', roles: ['CLINIC_STAFF'], first_name: 'Cora', last_name: 'Reyes', mfa_enrolled: false, deletion_requested_at: '2026-11-18T02:00:00Z', last_login_at: '2026-11-18T02:00:00Z', created_at: '2026-11-15T01:00:00Z' },
];

type Session = 'signedIn' | 'signedOut' | 'mfaSetup';

/**
 * Stands in for the backend so the suite runs without it (the console uses
 * cookie sessions; /auth/me tells it who is signed in).
 * `stepUpFirst`: sensitive admin calls answer STEP_UP_REQUIRED until /auth/mfa/step-up succeeds.
 */
export async function mockApi(page: Page, { session = 'signedIn', stepUpFirst = false }: { session?: Session; stepUpFirst?: boolean } = {}) {
  let state: Session = session;
  let steppedUp = !stepUpFirst;
  const needsStepUp = (route: Route) => {
    if (steppedUp) return false;
    void route.fulfill(fail(401, 'STEP_UP_REQUIRED', 'Confirm it is you to continue.'));
    return true;
  };

  await page.route('**/sanctum/csrf-cookie', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/v1/auth/me', (r) =>
    state === 'signedIn' ? r.fulfill(ok(admin)) : state === 'mfaSetup' ? r.fulfill(fail(401, 'MFA_REQUIRED', 'Set up two-step verification.')) : r.fulfill(fail(401, 'UNAUTHENTICATED', 'Unauthenticated.')),
  );
  await page.route('**/api/v1/auth/login', (r) => {
    const body = r.request().postDataJSON() as { password: string };
    if (body.password !== 'Correct-horse-42') return r.fulfill(fail(401, 'INVALID_CREDENTIALS', 'The credentials are incorrect.'));
    return r.fulfill(ok({ mfa_required: true, mfa_challenge_id: '01a1ec01-0000-7000-8000-0000000000c1', mfa_challenge_expires_at: '2026-11-19T01:05:00Z' }));
  });
  await page.route('**/api/v1/auth/mfa/verify', (r) => {
    const body = r.request().postDataJSON() as { code?: string };
    if (body.code !== '123456') return r.fulfill(fail(422, 'VALIDATION_FAILED', 'The code is incorrect or has expired.', { code: ['The code is incorrect or has expired.'] }));
    state = 'signedIn';
    return r.fulfill(ok({ user: admin, device_id: 'd1', mfa: { setup_required: false } }));
  });
  await page.route('**/api/v1/auth/mfa/totp/setup', (r) => r.fulfill(ok({ secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', otpauth_uri: 'otpauth://totp/MediConnect:admin%40example.test?secret=JBSWY3DPEHPK3PXP&issuer=MediConnect' })));
  await page.route('**/api/v1/auth/mfa/totp/confirm', (r) => {
    state = 'signedIn';
    return r.fulfill(ok({ recovery_codes: ['A1B2-C3D4', 'E5F6-G7H8', 'J9K1-L2M3', 'N4P5-Q6R7'], tokens: null }));
  });
  await page.route('**/api/v1/auth/mfa/step-up', (r) => {
    steppedUp = true;
    return r.fulfill(ok({ step_up_expires_at: '2026-11-19T01:10:00Z' }));
  });
  await page.route('**/api/v1/auth/logout', (r) => {
    state = 'signedOut';
    return r.fulfill(ok({}));
  });
  await page.route('**/api/v1/admin/overview', (r) => r.fulfill(ok({ users: { total: 3, active: 2, suspended: 1, pending_deletion: 1 }, patients: 2, dependents: 1, security_events_24h: 4 })));
  await page.route(/\/api\/v1\/admin\/users(\?.*)?$/, (r) => r.fulfill(ok(users, { page: 1, per_page: 25, total: users.length, last_page: 1 })));
  await page.route(/\/api\/v1\/admin\/users\/[^/]+$/, (r) => {
    const id = r.request().url().split('/').pop();
    const user = users.find((u) => u.id === id);
    return user ? r.fulfill(ok(user)) : r.fulfill(fail(404, 'NOT_FOUND', 'Not found.'));
  });
  await page.route(/\/api\/v1\/admin\/users\/[^/]+\/(suspend|reactivate)$/, (r) => {
    if (needsStepUp(r)) return;
    const [, id, action] = r.request().url().match(/users\/([^/]+)\/(suspend|reactivate)$/) ?? [];
    const user = users.find((u) => u.id === id)!;
    return r.fulfill(ok({ ...user, status: action === 'suspend' ? 'SUSPENDED' : 'ACTIVE' }));
  });
  await page.route(/\/api\/v1\/admin\/users\/[^/]+\/roles$/, (r) => {
    if (needsStepUp(r)) return;
    const id = r.request().url().split('/').slice(-2)[0];
    const body = r.request().postDataJSON() as { roles: string[] };
    return r.fulfill(ok({ ...users.find((u) => u.id === id)!, roles: body.roles }));
  });
  await page.route(/\/api\/v1\/admin\/audit-logs(\?.*)?$/, (r) =>
    r.fulfill(ok([
      { id: 2, occurred_at: '2026-11-18T03:00:00Z', actor_user_id: admin.id, actor_roles: 'ADMIN', action: 'user.suspended', subject_type: 'user', subject_id: users[1].id, changes: { reason: 'Reported abuse, ticket 123' }, is_access_event: false, request_id: 'req-2' },
      { id: 1, occurred_at: '2026-11-18T02:00:00Z', actor_user_id: null, actor_roles: null, action: 'rbac.role_assigned', subject_type: 'user', subject_id: users[2].id, changes: { role: 'CLINIC_STAFF' }, is_access_event: false, request_id: null },
    ], { page: 1, per_page: 50, total: 2, last_page: 1 })),
  );
  await page.route(/\/api\/v1\/admin\/settings$/, (r) => r.fulfill(ok([{ key: 'booking.max_days_ahead', value: 60, updated_by: admin.id, updated_at: '2026-11-18T03:00:00Z' }])));
  await page.route(/\/api\/v1\/admin\/settings\/[^/]+$/, (r) => {
    if (needsStepUp(r)) return;
    const key = r.request().url().split('/').pop();
    return r.fulfill(ok({ key, value: (r.request().postDataJSON() as { value: unknown }).value }));
  });
}
