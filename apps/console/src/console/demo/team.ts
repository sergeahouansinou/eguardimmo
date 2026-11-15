import type { Operator } from '../schemas/equipe';
import type {
  GeneralSettings,
  NotificationPrefs,
  Profile,
  SecuritySettings,
} from '../schemas/parametres';

export const CURRENT_IP = '81.250.xx.xx';

export function buildOperators(): Operator[] {
  return [
    { id: 'lucas-bernard', name: 'Lucas Bernard', email: 'lucas.bernard@eguardimmo.example', role: 'administrateur', twoFactor: true, lastLoginAt: '2026-11-13T20:58:00+01:00', invitedOn: null, state: 'actif', self: true },
    { id: 'ines-garnier', name: 'Inès Garnier', email: 'ines.garnier@eguardimmo.example', role: 'support', twoFactor: true, lastLoginAt: '2026-11-13T21:16:00+01:00', invitedOn: null, state: 'actif', self: false },
    { id: 'theo-marchand', name: 'Théo Marchand', email: 'theo.marchand@eguardimmo.example', role: 'ingenierie', twoFactor: true, lastLoginAt: '2026-11-13T21:24:00+01:00', invitedOn: null, state: 'actif', self: false },
    { id: 'karim-haddad', name: 'Karim Haddad', email: 'karim.haddad@eguardimmo.example', role: 'conformite', twoFactor: true, lastLoginAt: '2026-11-13T18:30:00+01:00', invitedOn: null, state: 'actif', self: false },
    { id: 'julie-fontaine', name: 'Julie Fontaine', email: 'julie.fontaine@eguardimmo.example', role: 'finance', twoFactor: true, lastLoginAt: '2026-11-12T17:10:00+01:00', invitedOn: null, state: 'actif', self: false },
    { id: 'sarah-colin', name: 'Sarah Colin', email: 'sarah.colin@eguardimmo.example', role: 'support', twoFactor: false, lastLoginAt: null, invitedOn: '2026-11-12', state: 'invitation', self: false },
  ];
}

export function buildGeneral(): GeneralSettings {
  return {
    webDomain: 'app.eguardimmo.fr',
    apiDomain: 'api.eguardimmo.fr',
    mailDomain: 'mail.eguardimmo.fr',
    senderName: 'eGuardImmo',
    senderEmail: 'ne-pas-repondre@mail.eguardimmo.fr',
    replyTo: 'support@eguardimmo.fr',
    emailsPerDay: 2000,
    maxFileMb: 10,
    storageGb: 50,
    backupRetentionDays: 30,
    certificatesValidUntil: '2027-02-14',
    spf: true,
    dkim: true,
    dmarcStrong: false,
    lastChange: { at: '2026-11-08T10:12:00+01:00', by: 'Lucas Bernard', summary: "Limite d'e-mails" },
  };
}

export function buildSecurity(): SecuritySettings {
  return {
    adminTwoFactor: true,
    hardwareKeys: true,
    ipAllowlistEnabled: true,
    ipAllowlist: ['81.250.xx.xx/32 · Bureau, Lyon', '92.184.xx.xx/32 · Astreinte, VPN', '176.143.xx.xx/32 · Hébergeur, supervision'],
    idleMinutes: 30,
    maxSessionHours: 8,
    justifiedAccessMinutes: 60,
    lockoutFailures: 5,
    lockoutMinutes: 15,
    currentIp: CURRENT_IP,
    me: { passwordChangedOn: '2026-10-21', method: "Application d'authentification", backupCodesLeft: 8 },
    lastChange: { at: '2026-11-08T14:05:00+01:00', by: 'Karim Haddad', summary: 'Durée des sessions' },
  };
}

export function buildNotificationPrefs(): NotificationPrefs {
  const on = [
    'canal.email', 'canal.push', 'incident.ouvert', 'incident.module', 'incident.sauvegarde', 'facturation.echec',
    'gouvernance.rgpd', 'gouvernance.echeance', 'gouvernance.ticket', 'securite.adresse', 'securite.blocage', 'securite.liste',
  ];
  const off = ['canal.sms', 'incident.latence', 'facturation.essai', 'gouvernance.acces'];
  const entries: [string, boolean][] = [...on.map((key): [string, boolean] => [key, true]), ...off.map((key): [string, boolean] => [key, false])];
  return Object.fromEntries(entries);
}

export function buildProfile(): Profile {
  return {
    firstName: 'Lucas',
    lastName: 'Bernard',
    email: 'lucas.bernard@eguardimmo.example',
    mobile: '+33 6 •• •• •• 12',
    language: 'fr',
    timezone: 'Europe/Paris',
    role: 'Administrateur',
    operatorSince: '2025-01-12',
    initials: 'LB',
    security: {
      passwordChangedOn: '2026-10-04',
      method: 'Application, activée',
      lastLoginAt: '2026-11-13T20:58:00+01:00',
      origin: '81.250.xx.xx',
    },
  };
}
