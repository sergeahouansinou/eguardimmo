import { z } from 'zod';
import { count, isoDateSchema, isoDateTimeSchema } from './common';

export const lastChangeSchema = z.object({ at: isoDateTimeSchema, by: z.string(), summary: z.string() });
export type LastChange = z.infer<typeof lastChangeSchema>;

const domainSchema = z
  .string()
  .trim()
  .regex(/^(?=.{4,100}$)([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/, 'Domaine invalide, par exemple app.eguardimmo.fr.');

export const generalSettingsInputSchema = z.object({
  webDomain: domainSchema,
  apiDomain: domainSchema,
  mailDomain: domainSchema,
  senderName: z.string().trim().min(1, 'Indiquez le nom de l’expéditeur.').max(80),
  senderEmail: z.email('Adresse e-mail invalide.'),
  replyTo: z.union([z.literal(''), z.email('Adresse e-mail invalide.')]),
  emailsPerDay: z.number().int().min(1, 'Au moins 1.').max(1_000_000),
  maxFileMb: z.number().int().min(1, 'Au moins 1 Mo.').max(500),
  storageGb: z.number().int().min(1, 'Au moins 1 Go.').max(100_000),
  backupRetentionDays: z.number().int().min(7, 'Au moins 7 jours.').max(365),
});
export type GeneralSettingsInput = z.infer<typeof generalSettingsInputSchema>;

export const generalSettingsSchema = generalSettingsInputSchema.extend({
  certificatesValidUntil: isoDateSchema,
  spf: z.boolean(),
  dkim: z.boolean(),
  dmarcStrong: z.boolean(),
  lastChange: lastChangeSchema,
});
export type GeneralSettings = z.infer<typeof generalSettingsSchema>;

const ipLineSchema = z.string().regex(/^[\dxX.:a-f]+(\/\d{1,3})?( · .{1,60})?$/i, 'Adresse attendue, par exemple 81.250.xx.xx/32 · Bureau.');

export const securitySettingsInputSchema = z
  .object({
    adminTwoFactor: z.boolean(),
    hardwareKeys: z.boolean(),
    ipAllowlistEnabled: z.boolean(),
    ipAllowlist: z.array(ipLineSchema).max(50),
    idleMinutes: z.number().int().min(5, 'Au moins 5 minutes.').max(240),
    maxSessionHours: z.number().int().min(1, 'Au moins 1 heure.').max(24),
    justifiedAccessMinutes: z.number().int().min(5, 'Au moins 5 minutes.').max(120, '120 minutes au plus.'),
    lockoutFailures: z.number().int().min(3, 'Au moins 3 échecs.').max(10),
    lockoutMinutes: z.number().int().min(5, 'Au moins 5 minutes.').max(240),
  })
  .refine((value) => !value.ipAllowlistEnabled || value.ipAllowlist.length > 0, {
    path: ['ipAllowlist'],
    message: 'Ajoutez au moins une adresse avant d’activer la liste blanche.',
  });
export type SecuritySettingsInput = z.infer<typeof securitySettingsInputSchema>;

export const securitySettingsSchema = z.object({
  adminTwoFactor: z.boolean(),
  hardwareKeys: z.boolean(),
  ipAllowlistEnabled: z.boolean(),
  ipAllowlist: z.array(z.string()),
  idleMinutes: count,
  maxSessionHours: count,
  justifiedAccessMinutes: count,
  lockoutFailures: count,
  lockoutMinutes: count,
  currentIp: z.string(),
  me: z.object({ passwordChangedOn: isoDateSchema, method: z.string(), backupCodesLeft: count }),
  lastChange: lastChangeSchema,
});
export type SecuritySettings = z.infer<typeof securitySettingsSchema>;

export const NOTIFICATION_GROUPS = [
  {
    id: 'canaux',
    label: 'Canaux',
    items: [
      { key: 'canal.email', label: 'E-mail', detail: 'lucas.bernard@eguardimmo.example' },
      { key: 'canal.push', label: 'Notification push', detail: 'Application opérateur, iPhone' },
      { key: 'canal.sms', label: "SMS d'astreinte", detail: 'Réservé aux incidents de sévérité 1' },
    ],
  },
  {
    id: 'incidents',
    label: 'Incidents et santé',
    items: [
      { key: 'incident.ouvert', label: 'Incident ouvert', detail: 'Dès l’ouverture, tous modules' },
      { key: 'incident.module', label: 'Module dégradé', detail: 'État Dégradé ou Arrêté' },
      { key: 'incident.sauvegarde', label: 'Échec de sauvegarde', detail: 'Sauvegarde quotidienne ou mensuelle' },
      { key: 'incident.latence', label: 'Latence élevée', detail: 'p95 de l’API au-dessus de 300 ms' },
    ],
  },
  {
    id: 'facturation',
    label: 'Facturation',
    items: [
      { key: 'facturation.echec', label: 'Paiement en échec', detail: 'Prélèvement refusé d’une organisation' },
      { key: 'facturation.essai', label: 'Fin d’essai proche', detail: '3 jours avant l’échéance' },
    ],
  },
  {
    id: 'gouvernance',
    label: 'Gouvernance',
    items: [
      { key: 'gouvernance.rgpd', label: 'Nouvelle demande RGPD', detail: 'Accès, effacement ou rectification' },
      { key: 'gouvernance.echeance', label: 'Échéance RGPD à 7 jours', detail: 'Demande encore à traiter' },
      { key: 'gouvernance.ticket', label: 'Ticket de priorité haute', detail: 'Dès sa création' },
      { key: 'gouvernance.acces', label: 'Accès justifié ouvert', detail: 'Un opérateur consulte une organisation' },
    ],
  },
  {
    id: 'securite',
    label: 'Sécurité',
    items: [
      { key: 'securite.adresse', label: 'Connexion depuis une nouvelle adresse', detail: 'Compte opérateur ou administrateur' },
      { key: 'securite.blocage', label: 'Compte bloqué après des échecs', detail: 'Verrouillage de 15 minutes' },
      { key: 'securite.liste', label: 'Liste blanche modifiée', detail: 'Ajout ou retrait d’une adresse' },
    ],
  },
] as const;

export const notificationKeys = NOTIFICATION_GROUPS.flatMap((group) => group.items.map((item) => item.key));

export const notificationPrefsSchema = z.record(z.string(), z.boolean());
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;

export const profileSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  mobile: z.string(),
  language: z.string(),
  timezone: z.string(),
  role: z.string(),
  operatorSince: isoDateSchema,
  initials: z.string(),
  security: z.object({
    passwordChangedOn: isoDateSchema,
    method: z.string(),
    lastLoginAt: isoDateTimeSchema,
    origin: z.string(),
  }),
});
export type Profile = z.infer<typeof profileSchema>;

export const profileInputSchema = z.object({
  firstName: z.string().trim().min(1, 'Indiquez le prénom.').max(60),
  lastName: z.string().trim().min(1, 'Indiquez le nom.').max(60),
  email: z.email('Adresse e-mail invalide.'),
  mobile: z.string().trim().max(30),
  language: z.string().min(1),
  timezone: z.string().min(1),
});
export type ProfileInput = z.infer<typeof profileInputSchema>;

export const PASSWORD_MIN_LENGTH = 6;

export const changePasswordInputSchema = z
  .object({
    current: z.string().min(1, 'Saisissez votre mot de passe actuel.'),
    next: z
      .string()
      .max(255, '255 caractères au maximum.')
      .refine((value) => Array.from(value).length >= PASSWORD_MIN_LENGTH, { error: `Au moins ${String(PASSWORD_MIN_LENGTH)} caractères.` }),
    confirm: z.string(),
  })
  .refine((value) => value.next === value.confirm, { path: ['confirm'], message: 'Les deux mots de passe diffèrent.' })
  .refine((value) => value.next !== value.current, { path: ['next'], message: 'Le nouveau mot de passe doit être différent.' });
export type ChangePasswordInput = z.input<typeof changePasswordInputSchema>;
