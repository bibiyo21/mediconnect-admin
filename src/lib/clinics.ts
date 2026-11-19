import type { components } from '@mediconnect/api-client';

export type ClinicDetail = components['schemas']['ClinicManagementResource'];
export type ClinicSummary = components['schemas']['ClinicSummaryResource'];
export type ClinicLocation = ClinicDetail['locations'][number];

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** "Mon 08:00–12:00, 13:00–17:00 · Sat 09:00–12:00" */
export function hoursSummary(hours: ClinicLocation['operating_hours']): string {
  if (hours.length === 0) return 'No hours set';
  const byDay = new Map<number, string[]>();
  for (const h of hours) byDay.set(h.day_of_week, [...(byDay.get(h.day_of_week) ?? []), `${h.opens_at}–${h.closes_at}`]);
  return [...byDay.entries()].sort(([a], [b]) => a - b).map(([d, r]) => `${DAYS[d - 1].slice(0, 3)} ${r.join(', ')}`).join(' · ');
}
