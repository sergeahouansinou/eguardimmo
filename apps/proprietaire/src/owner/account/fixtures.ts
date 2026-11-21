export const USER_ID = "0193a5e1-0000-7000-8000-000000000a01";
export const DEVICE_ID = "0193a5e1-0000-7000-8000-000000000a11";

export const ME = {
  id: USER_ID,
  name: "Aline Dossou",
  email: "aline@example.test",
  email_verified_at: "2026-10-02T09:00:00+00:00",
  phone: "+33612345678",
  last_login_at: "2026-11-19T08:00:00+00:00",
  previous_login_at: "2026-11-18T17:30:00+00:00",
};

export const PROFILES = {
  data: [
    { space: "owner", label: "Propriétaire mandant", meta: { links: 1 } },
    { space: "organization", label: "Gestion directe", meta: { organization: "0193a5e1-0000-7000-8000-0000000000c1", kind: "individual", role: "owner" } },
  ],
};

export const SECURITY = {
  email: "aline@example.test",
  email_verified: true,
  has_password: true,
  two_factor: { enabled: true, enabled_at: "2026-10-05T10:00:00+00:00", backup_codes_remaining: 6, backup_codes_total: 8 },
  linked_accounts: [
    { provider: "google", linked: true, email: "aline@gmail.test", linked_at: "2026-10-06T10:00:00+00:00" },
    { provider: "apple", linked: false, email: null, linked_at: null },
  ],
  devices: [{ id: DEVICE_ID, name: "iPhone d’Aline", type: "mobile", last_activity_at: "2026-11-19T07:00:00+00:00", current: true }],
  confirmed_until: null,
  confirmed_with_code_until: null,
};

export const DEVICES = {
  data: [{ id: DEVICE_ID, name: "iPhone d’Aline", last_used_at: "2026-11-19T07:00:00+00:00", created_at: "2026-10-05T10:00:00+00:00", expires_at: null, current: true }],
};
