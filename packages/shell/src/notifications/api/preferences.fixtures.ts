// Matrices de préférences réelles : compte d'équipe (propriétaire) et compte locataire.

export const preferencesStaff = {
  data: {
    types: [
      {
        type: 'rent.overdue',
        label: 'Loyer en retard',
        group: 'Finances',
        audience: 'staff',
        channels: [{ channel: 'in_app', label: 'Application', enabled: true, locked: false }, { channel: 'email', label: 'E-mail', enabled: true, locked: false }, { channel: 'push', label: 'Mobile', enabled: true, locked: false }],
      },
      {
        type: 'rent.payment_recorded',
        label: 'Paiement enregistré',
        group: 'Finances',
        audience: 'staff',
        channels: [{ channel: 'in_app', label: 'Application', enabled: true, locked: false }, { channel: 'email', label: 'E-mail', enabled: false, locked: false }, { channel: 'push', label: 'Mobile', enabled: false, locked: false }],
      },
      {
        type: 'rent.payment_cancelled',
        label: 'Paiement annulé',
        group: 'Finances',
        audience: 'staff',
        channels: [{ channel: 'in_app', label: 'Application', enabled: true, locked: true }, { channel: 'email', label: 'E-mail', enabled: true, locked: false }, { channel: 'push', label: 'Mobile', enabled: false, locked: false }],
      },
      {
        type: 'recovery.bundle_sent',
        label: 'Dossier de recouvrement transmis',
        group: 'Finances',
        audience: 'staff',
        channels: [{ channel: 'in_app', label: 'Application', enabled: true, locked: true }, { channel: 'email', label: 'E-mail', enabled: false, locked: false }, { channel: 'push', label: 'Mobile', enabled: false, locked: false }],
      },
      {
        type: 'compliance.certificate_to_renew',
        label: 'Pièce à renouveler',
        group: 'Conformité',
        audience: 'staff',
        channels: [{ channel: 'in_app', label: 'Application', enabled: true, locked: false }, { channel: 'email', label: 'E-mail', enabled: true, locked: false }, { channel: 'push', label: 'Mobile', enabled: false, locked: false }],
      },
      {
        type: 'compliance.certificate_expired',
        label: 'Pièce expirée',
        group: 'Conformité',
        audience: 'staff',
        channels: [{ channel: 'in_app', label: 'Application', enabled: true, locked: true }, { channel: 'email', label: 'E-mail', enabled: true, locked: false }, { channel: 'push', label: 'Mobile', enabled: true, locked: false }],
      },
      {
        type: 'lease.signed',
        label: 'Bail signé',
        group: 'Baux',
        audience: 'staff',
        channels: [{ channel: 'in_app', label: 'Application', enabled: true, locked: false }, { channel: 'email', label: 'E-mail', enabled: false, locked: false }, { channel: 'push', label: 'Mobile', enabled: false, locked: false }],
      },
    ],
  },
};

export const preferencesTenant = {
  data: {
    types: [
      {
        type: 'tenant.notice_issued',
        label: 'Avis d\'échéance émis',
        group: 'Loyers',
        audience: 'tenant',
        channels: [{ channel: 'in_app', label: 'Application', enabled: true, locked: false }, { channel: 'email', label: 'E-mail', enabled: true, locked: false }, { channel: 'push', label: 'Mobile', enabled: true, locked: false }],
      },
      {
        type: 'tenant.receipt_issued',
        label: 'Quittance émise',
        group: 'Loyers',
        audience: 'tenant',
        channels: [{ channel: 'in_app', label: 'Application', enabled: true, locked: false }, { channel: 'email', label: 'E-mail', enabled: true, locked: false }, { channel: 'push', label: 'Mobile', enabled: true, locked: false }],
      },
      {
        type: 'tenant.payment_recorded',
        label: 'Paiement enregistré',
        group: 'Loyers',
        audience: 'tenant',
        channels: [{ channel: 'in_app', label: 'Application', enabled: true, locked: false }, { channel: 'email', label: 'E-mail', enabled: true, locked: false }, { channel: 'push', label: 'Mobile', enabled: false, locked: false }],
      },
      {
        type: 'tenant.payment_cancelled',
        label: 'Paiement annulé',
        group: 'Loyers',
        audience: 'tenant',
        channels: [{ channel: 'in_app', label: 'Application', enabled: true, locked: true }, { channel: 'email', label: 'E-mail', enabled: true, locked: false }, { channel: 'push', label: 'Mobile', enabled: false, locked: false }],
      },
      {
        type: 'tenant.lease_signed',
        label: 'Bail signé',
        group: 'Baux',
        audience: 'tenant',
        channels: [{ channel: 'in_app', label: 'Application', enabled: true, locked: false }, { channel: 'email', label: 'E-mail', enabled: true, locked: false }, { channel: 'push', label: 'Mobile', enabled: false, locked: false }],
      },
    ],
  },
};

const ownerChannels = [
  { channel: 'in_app', label: 'Application', enabled: true, locked: false },
  { channel: 'email', label: 'E-mail', enabled: true, locked: false },
  { channel: 'push', label: 'Mobile', enabled: false, locked: false },
];

export const preferencesOwner = {
  data: {
    types: [
      { type: 'owner.approval_requested', label: 'Accord demandé', group: 'Interventions', audience: 'owner', channels: ownerChannels },
      { type: 'owner.report_published', label: 'Compte rendu de gestion disponible', group: 'Comptes rendus', audience: 'owner', channels: ownerChannels },
      {
        type: 'owner.account_change_contested',
        label: 'Changement de compte de paiement contesté',
        group: 'Compte de paiement',
        audience: 'owner',
        channels: [
          { channel: 'in_app', label: 'Application', enabled: true, locked: true },
          { channel: 'email', label: 'E-mail', enabled: true, locked: true },
          { channel: 'push', label: 'Mobile', enabled: false, locked: false },
        ],
      },
    ],
  },
};

export const preferencesStaffAndOwner = { data: { types: [...preferencesStaff.data.types, ...preferencesOwner.data.types] } };

export const preferencesStaffSaved = {
  data: {
    types: [
      {
        type: 'rent.overdue',
        label: 'Loyer en retard',
        group: 'Finances',
        audience: 'staff',
        channels: [{ channel: 'in_app', label: 'Application', enabled: true, locked: false }, { channel: 'email', label: 'E-mail', enabled: false, locked: false }, { channel: 'push', label: 'Mobile', enabled: true, locked: false }],
      },
      {
        type: 'rent.payment_recorded',
        label: 'Paiement enregistré',
        group: 'Finances',
        audience: 'staff',
        channels: [{ channel: 'in_app', label: 'Application', enabled: true, locked: false }, { channel: 'email', label: 'E-mail', enabled: false, locked: false }, { channel: 'push', label: 'Mobile', enabled: false, locked: false }],
      },
      {
        type: 'rent.payment_cancelled',
        label: 'Paiement annulé',
        group: 'Finances',
        audience: 'staff',
        channels: [{ channel: 'in_app', label: 'Application', enabled: true, locked: true }, { channel: 'email', label: 'E-mail', enabled: true, locked: false }, { channel: 'push', label: 'Mobile', enabled: false, locked: false }],
      },
      {
        type: 'recovery.bundle_sent',
        label: 'Dossier de recouvrement transmis',
        group: 'Finances',
        audience: 'staff',
        channels: [{ channel: 'in_app', label: 'Application', enabled: true, locked: true }, { channel: 'email', label: 'E-mail', enabled: false, locked: false }, { channel: 'push', label: 'Mobile', enabled: false, locked: false }],
      },
      {
        type: 'compliance.certificate_to_renew',
        label: 'Pièce à renouveler',
        group: 'Conformité',
        audience: 'staff',
        channels: [{ channel: 'in_app', label: 'Application', enabled: true, locked: false }, { channel: 'email', label: 'E-mail', enabled: true, locked: false }, { channel: 'push', label: 'Mobile', enabled: false, locked: false }],
      },
      {
        type: 'compliance.certificate_expired',
        label: 'Pièce expirée',
        group: 'Conformité',
        audience: 'staff',
        channels: [{ channel: 'in_app', label: 'Application', enabled: true, locked: true }, { channel: 'email', label: 'E-mail', enabled: true, locked: false }, { channel: 'push', label: 'Mobile', enabled: true, locked: false }],
      },
      {
        type: 'lease.signed',
        label: 'Bail signé',
        group: 'Baux',
        audience: 'staff',
        channels: [{ channel: 'in_app', label: 'Application', enabled: true, locked: false }, { channel: 'email', label: 'E-mail', enabled: false, locked: false }, { channel: 'push', label: 'Mobile', enabled: false, locked: false }],
      },
    ],
  },
};
