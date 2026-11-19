/**
 * The admin console's API client. Cookie session + CSRF (D-04): no token is
 * ever stored in JavaScript. Types come from the backend contract.
 */
import { ApiError, createApiClient, ensureCsrfCookie, unwrap, type components } from '@mediconnect/api-client';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

export const api = createApiClient({ baseUrl: API_URL, credentials: 'include', csrf: true });

/** Sanctum's CSRF cookie before a state-changing request. */
export function prepareWrites(): Promise<void> {
  return ensureCsrfCookie(API_URL);
}

export { ApiError, unwrap };
export type Account = components['schemas']['AccountResource'];
export type AdminUser = components['schemas']['AdminUserResource'];

/** The user closed the step-up dialog: nothing was sent. */
export class StepUpCancelled extends Error {
  constructor() {
    super('Verification cancelled. Nothing was changed.');
    this.name = 'StepUpCancelled';
  }
}

/** A message that is safe to show: never server internals. */
export function userMessage(error: unknown): string {
  if (error instanceof StepUpCancelled) return error.message;
  if (error instanceof ApiError) {
    if (error.status >= 500 || error.code === 'SERVER_ERROR') return 'Something went wrong on our side. Please try again.';
    if (error.code === 'RATE_LIMITED') return 'Too many attempts. Please wait a few minutes and try again.';
    if (error.status === 403) return 'You do not have permission to do this.';
    const first = Object.values(error.errors)[0]?.[0];
    return first ?? error.message;
  }
  return 'We could not reach the MediConnect API. Check your connection and try again.';
}

export function fieldError(error: unknown, field: string): string | undefined {
  return error instanceof ApiError ? error.errors[field]?.[0] : undefined;
}

export function isStepUpRequired(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'STEP_UP_REQUIRED';
}

/** "18 Nov 2026, 9:05 AM" in Manila time. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(d);
}
