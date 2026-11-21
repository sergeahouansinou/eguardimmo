export const healthResponse = {
  data: {
    status: 'unknown',
    checked_at: '2026-11-21T10:00:00+00:00',
    components: {
      database: { state: 'ok', latency_ms: 3 },
      queue: { state: 'ok', driver: 'database', queues: [{ queue: 'default', pending: 2, oldest_age_seconds: 12 }], failed_24h: 0 },
      scheduler: {
        state: 'ok',
        tasks: [
          {
            command: 'subscriptions:end-trials',
            status: 'succeeded',
            last_started_at: '2026-11-21T09:00:00+00:00',
            last_finished_at: '2026-11-21T09:00:01+00:00',
            duration_ms: 120,
            last_failed_at: null,
            late: false,
          },
        ],
      },
      antivirus: { state: 'unknown', enabled: true, latency_ms: null },
      pdf: { state: 'ok', configured: true, latency_ms: 45 },
      mail: { state: 'unknown', configured: true, last_event_at: null, bounces_24h: 0 },
      payments: { state: 'unknown', gateway: 'none' },
      backups: {
        state: 'ok',
        last_success_at: { database: '2026-11-21T03:00:00+00:00', documents: '2026-11-21T03:10:00+00:00' },
        max_age_hours: 26,
      },
    },
    links: { monitoring_url: 'https://supervision.exemple.test/', status_page_url: null },
  },
};

export const backupReport = (overrides: Record<string, unknown> = {}) => ({
  id: '01934f6e-1111-7000-8000-000000000001',
  kind: 'database',
  started_at: '2026-11-21T03:00:00+00:00',
  duration_seconds: 184,
  size_bytes: 41234567890,
  succeeded: true,
  manifest_sha256: 'a'.repeat(64),
  restore_test: null,
  recorded_at: '2026-11-21T03:05:00+00:00',
  ...overrides,
});

export const backupsResponse = (rows: Record<string, unknown>[] = [backupReport()], meta: Record<string, unknown> = {}) => ({
  data: rows,
  meta: {
    has_more: false,
    next_cursor: null,
    max_age_hours: 26,
    last_success_at: { database: '2026-11-21T03:00:00+00:00', documents: null },
    ...meta,
  },
});

export const settingsResponse = {
  data: {
    console: { token_ttl_minutes: 480, session_absolute_minutes: 720, reauthentication_minutes: 15 },
    sessions: { web_absolute_minutes: 1440 },
    support: { hours: '09:00-18:00', timezone: 'Europe/Paris', response_label: 'sous 24 h ouvrées' },
    broadcasts: { daily_recipients: 5000, hourly_sends: 20, hourly_tests: 10 },
    antivirus: { enabled: true },
    mail: { configured: false },
    payments: { gateway: 'provider' },
    approvals: { ttl_hours: 24 },
    privacy: { export_ttl_days: 30 },
    backups: { max_age_hours: 26 },
  },
};
