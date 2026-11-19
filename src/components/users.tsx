'use client';

import type { AdminUser } from '@/lib/api';
import { Badge } from './ui';

export const ROLES = ['PATIENT', 'DOCTOR', 'CLINIC_MANAGER', 'CLINIC_STAFF', 'ADMIN', 'MEDICAL_ADMIN', 'SUPER_ADMIN', 'FINANCE_OFFICER', 'SUPPORT_AGENT', 'MODERATOR'] as const;

export function StatusBadge({ user }: { user: AdminUser }) {
  if (user.deletion_requested_at) return <Badge tone="warning">Pending deletion</Badge>;
  if (user.status === 'SUSPENDED') return <Badge tone="error">Suspended</Badge>;
  if (user.status === 'DEACTIVATED') return <Badge>Deactivated</Badge>;
  return <Badge tone="success">Active</Badge>;
}
