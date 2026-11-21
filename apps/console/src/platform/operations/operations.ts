import type { ApiClient } from '@eguardimmo/api';
import { z } from 'zod';
import { CONSOLE_ROOT, count, cursorParams, dataOf, dateTime, filled, flag, listOf, nullableDateTime, parse, read } from '../transport';
import type { CursorPage, CursorQuery } from '../transport';

export const PROBE_STATES = ['ok', 'down', 'unknown'] as const;
export type ProbeState = (typeof PROBE_STATES)[number];

const probeState = z.enum(PROBE_STATES);

const healthSchema = dataOf(
  z.object({
    status: probeState,
    checked_at: dateTime,
    components: z.record(z.string(), z.object({ state: probeState }).loose()),
    links: z.object({ monitoring_url: z.url().nullable(), status_page_url: z.url().nullable() }),
  }),
);

export interface HealthComponent {
  key: string;
  state: ProbeState;
  details: { key: string; value: string }[];
  raw: Record<string, unknown>;
}

export interface Health {
  status: ProbeState;
  checkedAt: string;
  components: HealthComponent[];
  monitoringUrl: string | null;
  statusPageUrl: string | null;
}

function show(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

export async function fetchHealth(client: ApiClient): Promise<Health> {
  const { data } = await read(client, '/health', healthSchema);
  return {
    status: data.status,
    checkedAt: data.checked_at,
    components: Object.entries(data.components).map(([key, { state, ...details }]) => ({
      key,
      state,
      details: Object.entries(details).map(([name, value]) => ({ key: name, value: show(value) })),
      raw: details,
    })),
    monitoringUrl: data.links.monitoring_url,
    statusPageUrl: data.links.status_page_url,
  };
}

export const BACKUP_KINDS = ['database', 'documents', 'restore_test'] as const;
export type BackupKind = (typeof BACKUP_KINDS)[number];

const backupSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(BACKUP_KINDS),
  started_at: dateTime,
  duration_seconds: count.nullable(),
  size_bytes: count.nullable(),
  succeeded: z.boolean(),
  manifest_sha256: z.string().nullable(),
  restore_test: z.object({ target: z.string(), result: z.enum(['passed', 'failed']).nullable() }).nullable(),
  recorded_at: dateTime,
});

const backupsSchema = listOf(backupSchema, {
  max_age_hours: count,
  last_success_at: z.object({ database: nullableDateTime, documents: nullableDateTime }),
});

export interface BackupReport {
  id: string;
  kind: BackupKind;
  startedAt: string;
  durationSeconds: number | null;
  sizeBytes: number | null;
  succeeded: boolean;
  manifestSha256: string | null;
  restoreTest: { target: string; result: 'passed' | 'failed' | null } | null;
  recordedAt: string;
}

export interface BackupsPage extends CursorPage<BackupReport> {
  maxAgeHours: number;
  lastSuccess: { database: string | null; documents: string | null };
}

export interface BackupsQuery extends CursorQuery {
  kind?: BackupKind;
  succeeded?: boolean;
}

export async function fetchBackups(client: ApiClient, query: BackupsQuery = {}): Promise<BackupsPage> {
  const { data, meta } = parse(
    backupsSchema,
    await client.get(`${CONSOLE_ROOT}/backups`, { ...cursorParams(query), kind: filled(query.kind), succeeded: flag(query.succeeded) }),
  );
  return {
    rows: data.map((raw) => ({
      id: raw.id,
      kind: raw.kind,
      startedAt: raw.started_at,
      durationSeconds: raw.duration_seconds,
      sizeBytes: raw.size_bytes,
      succeeded: raw.succeeded,
      manifestSha256: raw.manifest_sha256,
      restoreTest: raw.restore_test,
      recordedAt: raw.recorded_at,
    })),
    hasMore: meta.has_more,
    nextCursor: meta.next_cursor,
    maxAgeHours: meta.max_age_hours,
    lastSuccess: meta.last_success_at,
  };
}

const settingsSchema = dataOf(
  z.object({
    console: z.object({ token_ttl_minutes: count, session_absolute_minutes: count, reauthentication_minutes: count }),
    sessions: z.object({ web_absolute_minutes: count }),
    support: z.object({ hours: z.string(), timezone: z.string(), response_label: z.string() }),
    broadcasts: z.object({ daily_recipients: count, hourly_sends: count, hourly_tests: count }),
    antivirus: z.object({ enabled: z.boolean() }),
    mail: z.object({ configured: z.boolean() }),
    payments: z.object({ gateway: z.enum(['none', 'fake', 'provider']) }),
    approvals: z.object({ ttl_hours: count }),
    privacy: z.object({ export_ttl_days: count }),
    backups: z.object({ max_age_hours: count }),
  }),
);

export interface PlatformSettings {
  consoleTokenMinutes: number;
  consoleSessionAbsoluteMinutes: number;
  reauthenticationMinutes: number;
  webSessionAbsoluteMinutes: number;
  supportHours: string;
  supportTimezone: string;
  supportResponseLabel: string;
  broadcastDailyRecipients: number;
  broadcastHourlySends: number;
  broadcastHourlyTests: number;
  antivirusEnabled: boolean;
  mailConfigured: boolean;
  paymentsGateway: 'none' | 'fake' | 'provider';
  approvalTtlHours: number;
  privacyExportTtlDays: number;
  backupMaxAgeHours: number;
}

export async function fetchSettings(client: ApiClient): Promise<PlatformSettings> {
  const { data } = await read(client, '/settings', settingsSchema);
  return {
    consoleTokenMinutes: data.console.token_ttl_minutes,
    consoleSessionAbsoluteMinutes: data.console.session_absolute_minutes,
    reauthenticationMinutes: data.console.reauthentication_minutes,
    webSessionAbsoluteMinutes: data.sessions.web_absolute_minutes,
    supportHours: data.support.hours,
    supportTimezone: data.support.timezone,
    supportResponseLabel: data.support.response_label,
    broadcastDailyRecipients: data.broadcasts.daily_recipients,
    broadcastHourlySends: data.broadcasts.hourly_sends,
    broadcastHourlyTests: data.broadcasts.hourly_tests,
    antivirusEnabled: data.antivirus.enabled,
    mailConfigured: data.mail.configured,
    paymentsGateway: data.payments.gateway,
    approvalTtlHours: data.approvals.ttl_hours,
    privacyExportTtlDays: data.privacy.export_ttl_days,
    backupMaxAgeHours: data.backups.max_age_hours,
  };
}
