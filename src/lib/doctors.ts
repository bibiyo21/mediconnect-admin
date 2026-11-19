import type { components } from '@mediconnect/api-client';

export type DoctorApplication = components['schemas']['AdminDoctorResource'];
export type DoctorQueueRow = components['schemas']['AdminDoctorSummaryResource'];
export type Credential = DoctorApplication['credentials'][number];

export const ONBOARDING_LABELS: Record<string, string> = {
  REGISTERED: 'Registered',
  DOCUMENTS_SUBMITTED: 'Waiting for review',
  UNDER_REVIEW: 'Under review',
  REJECTED: 'Changes requested',
  VERIFIED: 'Verified',
  ACTIVE: 'Active',
};

export const ONBOARDING_TONES: Record<string, 'neutral' | 'success' | 'warning' | 'error' | 'info'> = {
  REGISTERED: 'neutral', DOCUMENTS_SUBMITTED: 'info', UNDER_REVIEW: 'warning', REJECTED: 'error', VERIFIED: 'success', ACTIVE: 'success',
};

export const CREDENTIAL_LABELS: Record<string, string> = {
  PRC_ID: 'PRC ID', SPECIALTY_BOARD: 'Specialty board certificate', DIPLOMA: 'Medical diploma', OTHER: 'Other document',
};

/** The scan result in reviewer words. Only CLEAN files can be opened. */
export const SCAN_LABELS: Record<string, string> = {
  PENDING_SCAN: 'Security check running', CLEAN: 'Passed security check', QUARANTINED: 'Blocked: malware found', SCAN_FAILED: 'Blocked: security check failed',
};

export function fileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
