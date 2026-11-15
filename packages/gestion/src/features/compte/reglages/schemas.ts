import { z } from 'zod';

export const DISPLAY_NAMES = ['prenom-nom', 'nom-prenom'] as const;
export const CURRENCY_CHOICES = ['EUR', 'XOF'] as const;
export const DATE_FORMATS = ['jj/mm/aaaa', 'mm/jj/aaaa', 'aaaa-mm-jj'] as const;
export const TIMEZONES = ['Europe/Paris', 'Africa/Porto-Novo', 'Africa/Dakar', 'Africa/Abidjan'] as const;
export const AREA_UNITS = ['m2', 'ft2'] as const;
export const FISCAL_STARTS = ['01-01', '04-01', '07-01', '10-01'] as const;
export const TAX_REGIMES = ['foncier-reel', 'foncier-micro', 'lmnp-reel', 'lmnp-micro'] as const;

export const generalSchema = z.object({
  displayNames: z.enum(DISPLAY_NAMES),
  language: z.literal('fr'),
  currency: z.enum(CURRENCY_CHOICES),
  dateFormat: z.enum(DATE_FORMATS),
  timezone: z.enum(TIMEZONES),
  areaUnit: z.enum(AREA_UNITS),
  fiscalYearStart: z.enum(FISCAL_STARTS),
  taxRegime: z.enum(TAX_REGIMES),
  expertMode: z.boolean(),
  entryAssist: z.boolean(),
});
export type GeneralSettings = z.infer<typeof generalSchema>;

export const NUMBER_TOKENS = ['{année}', '{mois}', '{lot}', '{numéro}'] as const;

const knownTokens = (value: string) =>
  (value.match(/\{[^}]*\}/g) ?? []).every((token) => NUMBER_TOKENS.some((known) => known === token));

const baseFormat = z
  .string()
  .trim()
  .min(3, 'Saisissez un format de numérotation, par exemple QT-{année}-{numéro}.')
  .max(40, '40 caractères au maximum.')
  .refine(knownTokens, 'Variable inconnue. Variables possibles : {année}, {mois}, {lot}, {numéro}.');

const quittanceFormat = baseFormat.refine((value) => value.includes('{numéro}'), 'Le format doit contenir la variable {numéro}.');

const avisFormat = baseFormat.refine(
  (value) => ['{mois}', '{lot}', '{numéro}'].some((token) => value.includes(token)),
  'Le format doit contenir {mois}, {lot} ou {numéro} pour distinguer chaque avis.',
);

const fileName = z
  .string()
  .max(120)
  .refine((value) => /\.(png|jpe?g)$/i.test(value), 'Format PNG ou JPG attendu.');

export const AVIS_SCHEDULES = ['25-precedent', '20-precedent', '15-precedent', '01-mois'] as const;

export const documentsSchema = z.object({
  quittanceFormat,
  quittanceNext: z.record(z.string(), z.string()),
  avisFormat,
  avisNext: z.record(z.string(), z.string()),
  logoName: fileName,
  signatureName: fileName,
  footer: z.string().trim().max(200, '200 caractères au maximum.'),
  qrCode: z.boolean(),
  tenantBalance: z.boolean(),
  chargesDetail: z.boolean(),
  avisAuto: z.boolean(),
  avisSchedule: z.enum(AVIS_SCHEDULES),
  quittanceAuto: z.boolean(),
  copyToMe: z.boolean(),
});
export type DocumentsSettings = z.infer<typeof documentsSchema>;

export const MENU_GROUPS = ['principal', 'suivi', 'outils'] as const;
export type MenuGroup = (typeof MENU_GROUPS)[number];
export const HOME_PAGES = ['accueil', 'biens', 'locataires', 'finances', 'messages'] as const;
export const TENANT_TABS = ['a-suivre', 'tous', 'candidats'] as const;
export const FINANCE_TABS = ['a-encaisser', 'operations', 'impayes'] as const;

export const menuModuleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  group: z.enum(MENU_GROUPS),
  visible: z.boolean(),
  locked: z.boolean(),
});
export type MenuModule = z.infer<typeof menuModuleSchema>;

export const menuSchema = z.object({
  homePage: z.enum(HOME_PAGES),
  tenantsTab: z.enum(TENANT_TABS),
  financesTab: z.enum(FINANCE_TABS),
  modules: z
    .array(menuModuleSchema)
    .refine((modules) => modules.every((entry) => !entry.locked || entry.visible), 'Une rubrique principale doit rester affichée.'),
});
export type MenuSettings = z.infer<typeof menuSchema>;

export const CHANNELS = ['email', 'app', 'mobile'] as const;
export type Channel = (typeof CHANNELS)[number];
export const CHANNEL_LABELS: Record<Channel, string> = { email: 'E-mail', app: 'Application', mobile: 'Mobile' };

export const NOTIFICATION_GROUPS = ['Finances', 'Locataires et baux', 'Suivi', 'Documents'] as const;
export type NotificationGroup = (typeof NOTIFICATION_GROUPS)[number];

export const channelsSchema = z.object({ email: z.boolean(), app: z.boolean(), mobile: z.boolean() });

export const notificationEventSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  group: z.enum(NOTIFICATION_GROUPS),
  channels: channelsSchema,
});
export type NotificationEvent = z.infer<typeof notificationEventSchema>;

export const DIGESTS = ['lundi', 'quotidien', 'jamais'] as const;

export const notificationsSchema = z.object({
  events: z.array(notificationEventSchema),
  digest: z.enum(DIGESTS),
  quietHours: z.boolean(),
  productNews: z.boolean(),
  monthlyLetter: z.boolean(),
  partnerOffers: z.boolean(),
});
export type NotificationsSettings = z.infer<typeof notificationsSchema>;
