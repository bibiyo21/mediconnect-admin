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


export const DOCTOR_ID = '01a1ed01-0000-7000-8000-00000000d001';
const doctorBase = {
  id: DOCTOR_ID, display_name: 'Dr. Ana Reyes', professional_title: 'MD', biography: null, prc_license_number: '0123456',
  license_verification_status: 'NOT_VERIFIED', medical_school: 'Example College of Medicine', years_experience: 8, profile_completeness: 80,
  specialties: [{ id: '01a1ed01-0000-7000-8000-00000000e001', specialty_name: 'Pediatrics', subspecialty_name: null, is_primary: true, board_certified: true, verification_status: 'SELF_REPORTED' }],
  credentials: [
    { id: '01a1ed01-0000-7000-8000-00000000f001', credential_type: 'PRC_ID', original_filename: 'prc-id.pdf', mime_type: 'application/pdf', size_bytes: 182_000, scan_status: 'CLEAN', status: 'SUBMITTED', review_note: null as string | null, expires_on: '2028-05-17' as string | null, downloadable: true, uploaded_at: '2026-11-19T02:00:00Z' },
    { id: '01a1ed01-0000-7000-8000-00000000f002', credential_type: 'OTHER', original_filename: 'certificate.pdf', mime_type: 'application/pdf', size_bytes: 52_000, scan_status: 'QUARANTINED', status: 'SUBMITTED', review_note: null as string | null, expires_on: null as string | null, downloadable: false, uploaded_at: '2026-11-19T02:05:00Z' },
  ],
  verification_history: [
    { from_status: null, to_status: 'REGISTERED', reason: null, occurred_at: '2026-11-18T09:00:00Z' },
    { from_status: 'REGISTERED', to_status: 'DOCUMENTS_SUBMITTED', reason: null, occurred_at: '2026-11-19T02:10:00Z' },
  ],
};

type Session = 'signedIn' | 'signedOut' | 'mfaSetup';

/**
 * Stands in for the backend so the suite runs without it (the console uses
 * cookie sessions; /auth/me tells it who is signed in).
 * `stepUpFirst`: sensitive admin calls answer STEP_UP_REQUIRED until /auth/mfa/step-up succeeds.
 */
export async function mockApi(page: Page, { session = 'signedIn', stepUpFirst = false, roles = ['ADMIN'] }: { session?: Session; stepUpFirst?: boolean; roles?: string[] } = {}) {
  let state: Session = session;
  const me = { ...admin, roles };
  let steppedUp = !stepUpFirst;
  const needsStepUp = (route: Route) => {
    if (steppedUp) return false;
    void route.fulfill(fail(401, 'STEP_UP_REQUIRED', 'Confirm it is you to continue.'));
    return true;
  };

  await page.route('**/sanctum/csrf-cookie', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/v1/auth/me', (r) =>
    state === 'signedIn' ? r.fulfill(ok(me)) : state === 'mfaSetup' ? r.fulfill(fail(401, 'MFA_REQUIRED', 'Set up two-step verification.')) : r.fulfill(fail(401, 'UNAUTHENTICATED', 'Unauthenticated.')),
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
  const specialties = [
    { id: '01a1ec01-0000-7000-8000-00000000s001', name: 'Cardiology', slug: 'cardiology', synonyms: ['cardiologist', 'heart doctor'], is_active: true, review_status: 'PENDING_REVIEW', subspecialties: [{ id: '01a1ec01-0000-7000-8000-00000000u001', name: 'Interventional Cardiology', slug: 'interventional-cardiology', is_active: true }] },
    { id: '01a1ec01-0000-7000-8000-00000000s002', name: 'Pediatrics', slug: 'pediatrics', synonyms: ['pediatrician', 'pedia'], is_active: true, review_status: 'REVIEWED', subspecialties: [] },
    { id: '01a1ec01-0000-7000-8000-00000000s003', name: 'Radiology', slug: 'radiology', synonyms: [], is_active: false, review_status: 'REVIEWED', subspecialties: [] },
  ];
  await page.route(/\/api\/v1\/admin\/specialties$/, (r) => {
    if (r.request().method() === 'POST') {
      const body = r.request().postDataJSON() as { name: string; synonyms: string[] };
      return r.fulfill(json(201, { success: true, data: { id: 'new', name: body.name, slug: body.name.toLowerCase(), synonyms: body.synonyms, is_active: true, review_status: 'REVIEWED', subspecialties: [] }, meta: {}, message: null }));
    }
    return r.fulfill(ok(specialties));
  });
  await page.route(/\/api\/v1\/admin\/specialties\/[^/]+$/, (r) => {
    const id = r.request().url().split('/').pop();
    const s = specialties.find((x) => x.id === id)!;
    return r.fulfill(ok({ ...s, ...(r.request().postDataJSON() as object) }));
  });
  const canManage = roles.some((r) => ['ADMIN', 'SUPER_ADMIN', 'CLINIC_MANAGER'].includes(r));
  let clinic = {
    id: '01a1ec01-0000-7000-8000-00000000c001', name: 'Santos Family Clinic', slug: 'santos-family-clinic', description: 'Family care in Makati.', status: 'ACTIVE',
    organization: { id: 'o1', name: 'Santos Medical Group', legal_name: null, organization_type: 'CLINIC_GROUP' },
    locations: [{
      id: '01a1ec01-0000-7000-8000-00000000l001', name: 'Makati branch', address_line1: '12 Mabini St', address_line2: null, barangay: 'Poblacion', city: 'Makati', province: null, postal_code: '1210',
      latitude: null, longitude: null, timezone: 'Asia/Manila', phone: '+63281234567', hospital_name: null, status: 'ACTIVE',
      operating_hours: [{ day_of_week: 1, opens_at: '08:00', closes_at: '12:00' }, { day_of_week: 1, opens_at: '13:00', closes_at: '17:00' }],
      services: [{ id: 'sv1', name: 'Laboratory', description: null, default_duration_minutes: 15, status: 'ACTIVE' }],
    }],
    holidays: [{ id: 'h1', clinic_location_id: null, date: '2026-12-25', name: 'Christmas Day', is_closed: true, special_opens_at: null, special_closes_at: null }],
    members: [{ id: 'm1', user_id: 'u1', name: 'Cora Reyes', email: 'clinic.staff@example.test', mobile_masked: null, member_role: 'CLINIC_STAFF', clinic_location_id: null, joined_at: '2026-11-18T02:00:00Z' }],
    abilities: { update: canManage, manage_hours: canManage, manage_staff: canManage, manage_doctors: canManage },
  };
  let assignments = [{
    id: 'as1', status: 'ACTIVE', doctor_profile_id: 'dp1', doctor_display_name: 'Dr. Ana Reyes', clinic_id: clinic.id, clinic_name: clinic.name,
    clinic_location_id: clinic.locations[0].id, location_name: 'Makati branch', location_city: 'Makati', effective_from: '2026-11-19T02:00:00Z' as string | null, effective_until: null, end_reason: null, requested_at: '2026-11-18T02:00:00Z',
  }];
  await page.route(/\/api\/v1\/clinics\/[^/]+\/doctor-assignments$/, (r) => r.fulfill(ok(assignments)));
  await page.route(/\/api\/v1\/clinics\/[^/]+\/doctors$/, (r) => {
    const { prc_license_number } = r.request().postDataJSON() as { prc_license_number: string };
    if (prc_license_number === '9999999') return r.fulfill(json(422, { success: false, message: 'Validation failed.', errors: { prc_license_number: ['No verified doctor on MediConnect has this licence number.'] }, code: 'VALIDATION_FAILED' }));
    const created = { ...assignments[0], id: 'as2', status: 'PENDING', doctor_display_name: 'Dr. Ben Cruz', effective_from: null, requested_at: '2026-11-20T02:00:00Z' };
    assignments = [...assignments, created];
    return r.fulfill(json(201, { success: true, data: created, meta: {}, message: null }));
  });
  const summary = { id: clinic.id, name: clinic.name, slug: clinic.slug, status: 'ACTIVE', organization: { id: 'o1', name: 'Santos Medical Group', organization_type: 'CLINIC_GROUP' }, location_count: 1, cities: ['Makati'] };
  await page.route(/\/api\/v1\/admin\/clinics(\?.*)?$/, (r) => r.request().method() === 'POST'
    ? r.fulfill(json(201, { success: true, data: { ...clinic, id: 'new-clinic' }, meta: {}, message: null }))
    : r.fulfill(ok([summary], { page: 1, per_page: 100, total: 1, last_page: 1 })));
  await page.route('**/api/v1/me/clinics', (r) => r.fulfill(ok([summary])));
  await page.route(/\/api\/v1\/clinics\/[^/]+\/management$/, (r) => r.fulfill(ok(clinic)));
  await page.route(/\/api\/v1\/clinics\/[^/]+\/locations\/[^/]+\/operating-hours$/, (r) => {
    const body = r.request().postDataJSON() as { hours: typeof clinic.locations[0]['operating_hours'] };
    clinic = { ...clinic, locations: [{ ...clinic.locations[0], operating_hours: body.hours }] };
    return r.fulfill(ok(clinic));
  });
  await page.route(/\/api\/v1\/clinics\/[^/]+\/members$/, (r) => {
    const body = r.request().postDataJSON() as { email: string; member_role: string };
    if (body.email === 'nobody@example.test') return r.fulfill(fail(422, 'VALIDATION_FAILED', 'Validation failed', { email: ['No active MediConnect account uses this address. Ask the person to create an account first.'] }));
    clinic = { ...clinic, members: [...clinic.members, { id: 'm2', user_id: 'u2', name: 'Dan Lim', email: body.email, mobile_masked: null, member_role: body.member_role, clinic_location_id: null, joined_at: '2026-11-19T02:00:00Z' }] };
    return r.fulfill(json(201, { success: true, data: clinic, meta: {}, message: null }));
  });
  await page.route(/\/api\/v1\/admin\/settings$/, (r) => r.fulfill(ok([{ key: 'booking.max_days_ahead', value: 60, updated_by: admin.id, updated_at: '2026-11-18T03:00:00Z' }])));
  await page.route(/\/api\/v1\/admin\/settings\/[^/]+$/, (r) => {
    if (needsStepUp(r)) return;
    const key = r.request().url().split('/').pop();
    return r.fulfill(ok({ key, value: (r.request().postDataJSON() as { value: unknown }).value }));
  });

  let doctor = { ...doctorBase, onboarding_status: 'DOCUMENTS_SUBMITTED' as string };
  await page.route(/\/api\/v1\/admin\/doctors(\?.*)?$/, (r) => r.fulfill(ok([{ id: DOCTOR_ID, display_name: doctor.display_name, professional_title: 'MD', onboarding_status: doctor.onboarding_status, submitted_at: '2026-11-19T02:10:00Z', document_count: 2, profile_completeness: 80 }], { page: 1, per_page: 25, total: 1, last_page: 1 })));
  await page.route(/\/api\/v1\/admin\/doctors\/[^/]+$/, (r) => r.fulfill(ok(doctor)));
  await page.route(/\/api\/v1\/admin\/doctors\/[^/]+\/start-review$/, (r) => {
    doctor = { ...doctor, onboarding_status: 'UNDER_REVIEW', verification_history: [...doctor.verification_history, { from_status: 'DOCUMENTS_SUBMITTED', to_status: 'UNDER_REVIEW', reason: null, occurred_at: '2026-11-19T03:00:00Z' }] };
    return r.fulfill(ok(doctor));
  });
  await page.route(/\/api\/v1\/admin\/doctors\/[^/]+\/credentials\/[^/]+\/download-url$/, (r) =>
    r.fulfill(ok({ url: 'http://localhost:8000/api/v1/doctors/credentials/test/file?signature=test', expires_at: '2026-11-19T03:05:00Z' })));
  await page.route(/\/api\/v1\/admin\/doctors\/[^/]+\/credentials\/[^/]+\/review$/, (r) => {
    const credentialId = r.request().url().split('/').at(-2);
    const { decision, note } = r.request().postDataJSON() as { decision: string; note: string | null };
    doctor = { ...doctor, credentials: doctor.credentials.map((c) => (c.id === credentialId ? { ...c, status: decision, review_note: note } : c)) };
    return r.fulfill(ok(doctor.credentials.find((c) => c.id === credentialId)));
  });
  await page.route(/\/api\/v1\/admin\/doctors\/[^/]+\/verify$/, (r) => {
    if (needsStepUp(r)) return;
    doctor = { ...doctor, onboarding_status: 'VERIFIED', license_verification_status: 'VERIFIED', verification_history: [...doctor.verification_history, { from_status: 'UNDER_REVIEW', to_status: 'VERIFIED', reason: null, occurred_at: '2026-11-19T03:10:00Z' }] };
    return r.fulfill(ok(doctor));
  });

  // Search curation (3.4); test fixtures only.
  let zeroResults = [{ id: 'zr1', query: 'kardyolohista', collection: 'doctors', occurrences: 7, first_seen_at: '2026-11-18T02:00:00Z', last_seen_at: '2026-11-20T01:00:00Z', status: 'NEW' }];
  let synonymGroups = [{ id: 'sy1', synonyms: ['pediatrics', 'pediatrician', 'pedia'], root_term: null as string | null, status: 'ACTIVE', updated_at: '2026-11-20T00:00:00Z' }];
  await page.route('**/api/v1/admin/search/overview', (r) => r.fulfill(ok({ days: 7, searches: 1240, zero_result_rate: 0.031, cache_hit_rate: 0.62, degraded_rate: 0, latency_ms: { p50: 18, p95: 64, p99: 120 }, top_queries: [{ query: 'pediatrics', searches: 210 }], open_zero_results: zeroResults.length })));
  await page.route(/\/api\/v1\/admin\/search\/zero-results(\?.*)?$/, (r) => r.fulfill(ok(zeroResults, { page: 1, per_page: 25, total: zeroResults.length, last_page: 1 })));
  await page.route(/\/api\/v1\/admin\/search\/zero-results\/[^/]+\/ignore$/, (r) => { zeroResults = []; return r.fulfill(ok({ status: 'IGNORED' })); });
  await page.route(/\/api\/v1\/admin\/search\/synonyms(\?.*)?$/, (r) => {
    if (r.request().method() === 'POST') {
      const body = r.request().postDataJSON() as { synonyms: string[]; zero_result_id?: string };
      const created = { id: `sy${synonymGroups.length + 1}`, synonyms: body.synonyms.map((t) => t.toLowerCase()), root_term: null, status: 'ACTIVE', updated_at: '2026-11-20T02:00:00Z' };
      synonymGroups = [...synonymGroups, created];
      if (body.zero_result_id) zeroResults = zeroResults.filter((z) => z.id !== body.zero_result_id);
      return r.fulfill(json(201, { success: true, data: { ...created, synced: true }, meta: {}, message: null }));
    }
    return r.fulfill(ok(synonymGroups));
  });
  await page.route(/\/api\/v1\/admin\/search\/synonyms\/[^/]+$/, (r) => { synonymGroups = synonymGroups.filter((s) => !r.request().url().endsWith(s.id)); return r.fulfill(ok({ status: 'INACTIVE' })); });
}
