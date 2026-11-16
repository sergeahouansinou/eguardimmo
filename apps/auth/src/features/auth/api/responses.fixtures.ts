export const IDS = {
  user: "0199a1b2-7c3d-7e4f-8a5b-1c2d3e4f5a6b",
  org: "0199a1b2-7c3d-7e4f-8a5b-9a8b7c6d5e4f",
  device: "0199a1b2-7c3d-7e4f-8a5b-00112233aabb",
} as const;

export const meResponse = {
  data: {
    id: IDS.user,
    name: "Jeanne Martin",
    email: "jeanne@exemple.fr",
    email_verified_at: "2026-11-10T09:00:00+00:00",
    last_login_at: "2026-11-14T18:30:00+00:00",
    previous_login_at: null,
  },
};

export const profilesResponse = {
  data: [
    { space: "organization", label: "Agence Les Tilleuls", meta: { organization: IDS.org, kind: "agency", role: "owner" } },
    { space: "organization", label: "Jeanne Martin", meta: { organization: "0199a1b2-7c3d-7e4f-8a5b-aaaaaaaaaaaa", kind: "individual", role: "admin" } },
    { space: "tenant", label: "Résidence du Parc", meta: {} },
    { space: "owner", label: "Mandat Les Tilleuls", meta: {} },
    { space: "operator", label: "Console", meta: {} },
  ],
};

export const loginResponse = { two_factor: false };
export const loginTwoFactorResponse = { two_factor: true };

export const secretKeyResponse = { secretKey: "JBSWY3DPEHPK3PXP" };

export const qrCodeResponse = {
  svg: "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>",
  url: "otpauth://totp/eGuardImmo:jeanne%40exemple.fr?secret=JBSWY3DPEHPK3PXP&issuer=eGuardImmo",
};

export const recoveryCodesResponse = [
  "k3Jx9aQw2L-p0Zr7Tm4Vn",
  "b8Yd1cEo5H-u6Gs2Wf9Ia",
  "m4Nq7vXz0R-e3Kt8Cl1Pj",
];

export const SIGNED_VERIFY_URL = `https://api.test/api/v1/auth/email/verify/${IDS.user}/da39a3ee5e6b4b0d3255bfef95601890afd80709?expires=1795000000&signature=5f4dcc3b5aa765d61d8327deb882cf99e3b0c44298fc1c149afbf4c8996fb924`;

export const resetStatusValid = { data: { status: "valid" } };
export const resetStatusExpired = { data: { status: "expired" } };

export const securityResponse = {
  data: {
    email: "jeanne@exemple.fr",
    email_verified: true,
    has_password: true,
    two_factor: { enabled: true, enabled_at: "2026-11-12T08:15:00+00:00", backup_codes_remaining: 6, backup_codes_total: 8 },
    linked_accounts: [
      { provider: "google", linked: true, email: "jeanne@gmail.test", linked_at: "2026-11-11T10:00:00+00:00" },
      { provider: "apple", linked: false, email: null, linked_at: null },
    ],
    devices: [{ id: IDS.device, name: "iPhone de Jeanne", type: "mobile", last_activity_at: "2026-11-14T18:30:00+00:00", current: false }],
    confirmed_until: "2026-11-15T10:05:00+00:00",
    confirmed_with_code_until: null,
  },
};
