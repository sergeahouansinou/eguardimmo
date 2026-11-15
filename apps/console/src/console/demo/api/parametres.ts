import {
  ConsoleError,
  changePasswordInputSchema,
  generalSettingsInputSchema,
  generalSettingsSchema,
  notificationKeys,
  notificationPrefsSchema,
  profileInputSchema,
  profileSchema,
  securitySettingsInputSchema,
  securitySettingsSchema,
} from '../../schemas';
import type { ParametresApi } from '../../source';
import type { DemoContext } from '../context';
import { CURRENT_IP } from '../team';

const MIN_PASSWORD_UPDATE = 'Mot de passe actuel incorrect.';

export function parametresApi(ctx: DemoContext, verifyPassword: (password: string) => boolean, rotatePassword: (password: string) => void): ParametresApi {
  const stamp = (summary: string) => ({ at: ctx.clock().toISOString(), by: 'Lucas Bernard', summary });
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(ctx.clock());

  return {
    general: () => Promise.resolve(generalSettingsSchema.parse(ctx.state.general)),

    saveGeneral: (rawInput) => {
      const input = generalSettingsInputSchema.parse(rawInput);
      const previous = ctx.state.general;
      const changed = (Object.keys(input) as (keyof typeof input)[]).filter((key) => input[key] !== previous[key]);
      if (changed.length === 0) throw new ConsoleError('invalid', 'Aucune modification à enregistrer.');
      ctx.state.general = { ...previous, ...input, lastChange: stamp(changed.length === 1 ? (changed[0] ?? 'Paramètres') : `${String(changed.length)} paramètres`) };
      ctx.audit.record({
        type: 'configuration',
        title: 'Paramètres généraux modifiés',
        context: changed.join(', '),
        action: 'Modification des paramètres',
        module: 'Paramètres',
        request: 'PUT /api/console/parametres/general',
        before: Object.fromEntries(changed.map((key) => [key, String(previous[key])])),
        after: Object.fromEntries(changed.map((key) => [key, String(input[key])])),
      });
      return Promise.resolve();
    },

    security: () => Promise.resolve(securitySettingsSchema.parse(ctx.state.security)),

    saveSecurity: (rawInput) => {
      const input = securitySettingsInputSchema.parse(rawInput);
      if (input.ipAllowlistEnabled && !input.ipAllowlist.some((line) => line.startsWith(CURRENT_IP))) {
        throw new ConsoleError('invalid', 'Votre adresse actuelle doit figurer dans la liste blanche : sinon la console devient inaccessible.');
      }
      const previous = ctx.state.security;
      const changed = (Object.keys(input) as (keyof typeof input)[]).filter((key) => JSON.stringify(input[key]) !== JSON.stringify(previous[key]));
      if (changed.length === 0) throw new ConsoleError('invalid', 'Aucune modification à enregistrer.');
      ctx.state.security = { ...previous, ...input, lastChange: stamp(changed.length === 1 ? (changed[0] ?? 'Sécurité') : `${String(changed.length)} réglages`) };
      ctx.audit.record({
        type: 'securite',
        title: 'Paramètres de sécurité modifiés',
        context: changed.join(', '),
        action: 'Modification de la sécurité',
        module: 'Paramètres',
        request: 'PUT /api/console/parametres/securite',
        before: Object.fromEntries(changed.map((key) => [key, JSON.stringify(previous[key])])),
        after: Object.fromEntries(changed.map((key) => [key, JSON.stringify(input[key])])),
      });
      return Promise.resolve();
    },

    notifications: () => Promise.resolve(notificationPrefsSchema.parse(ctx.state.notificationPrefs)),

    saveNotifications: (rawInput) => {
      const input = notificationPrefsSchema.parse(rawInput);
      if (!notificationKeys.every((key) => typeof input[key] === 'boolean')) throw new ConsoleError('invalid', 'Préférences incomplètes.');
      ctx.state.notificationPrefs = Object.fromEntries(notificationKeys.map((key) => [key, input[key] === true]));
      ctx.audit.record({
        type: 'configuration',
        title: 'Préférences de notification modifiées',
        context: 'Lucas Bernard',
        action: 'Modification des notifications',
        module: 'Paramètres',
        request: 'PUT /api/console/parametres/notifications',
      });
      return Promise.resolve();
    },

    profile: () => Promise.resolve(profileSchema.parse(ctx.state.profile)),

    saveProfile: (rawInput) => {
      const input = profileInputSchema.parse(rawInput);
      const previous = ctx.state.profile;
      const mobileChanged = input.mobile !== '' && input.mobile !== previous.mobile;
      if (mobileChanged && !/^\+?[\d\s.()-]{8,20}$/.test(input.mobile)) throw new ConsoleError('invalid', 'Numéro de mobile invalide.');
      ctx.state.profile = {
        ...previous,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        mobile: mobileChanged ? input.mobile : previous.mobile,
        language: input.language,
        timezone: input.timezone,
        initials: `${input.firstName.charAt(0)}${input.lastName.charAt(0)}`.toUpperCase(),
      };
      ctx.audit.record({
        type: 'compte',
        title: 'Profil opérateur modifié',
        context: `${input.firstName} ${input.lastName}`,
        action: 'Modification du profil',
        module: 'Paramètres',
        request: 'PATCH /api/console/moi',
        before: { Nom: `${previous.firstName} ${previous.lastName}`, 'E-mail': previous.email },
        after: { Nom: `${input.firstName} ${input.lastName}`, 'E-mail': input.email },
      });
      return Promise.resolve();
    },

    changePassword: (rawInput) => {
      const input = changePasswordInputSchema.parse(rawInput);
      if (!verifyPassword(input.current)) throw new ConsoleError('invalid', MIN_PASSWORD_UPDATE);
      rotatePassword(input.next);
      ctx.state.profile.security.passwordChangedOn = today();
      ctx.state.security.me.passwordChangedOn = today();
      ctx.audit.record({
        type: 'securite',
        title: 'Mot de passe modifié',
        context: 'Lucas Bernard, autres sessions révoquées',
        action: 'Changement de mot de passe',
        module: 'Paramètres',
        request: 'PUT /api/console/moi/mot-de-passe',
      });
      return Promise.resolve();
    },

    regenerateBackupCodes: () => {
      ctx.state.security.me.backupCodesLeft = 10;
      ctx.audit.record({
        type: 'securite',
        title: 'Codes de secours régénérés',
        context: 'Lucas Bernard, anciens codes invalidés',
        action: 'Régénération des codes de secours',
        module: 'Paramètres',
        request: 'POST /api/console/moi/codes-de-secours',
      });
      return Promise.resolve({ count: 10 });
    },
  };
}
