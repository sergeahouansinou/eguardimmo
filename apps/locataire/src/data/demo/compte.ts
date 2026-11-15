import type { ShellData } from '@eguardimmo/shell';
import { SourceError } from '../errors';
import type { DemoState } from '../demoState';
import { preferenceInputSchema, profileInputSchema } from '../schemas/compte';
import type { PreferenceInput, ProfileInput } from '../schemas/compte';
import { run } from './run';

export const DEMO_CONFIRMATION_CODE = '123456';

export function shellOf(state: DemoState): ShellData {
  const { profile, lease } = state;
  return {
    user: {
      firstName: profile.firstName,
      fullName: `${profile.firstName} ${profile.lastName}`,
      initials: `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase(),
      email: profile.email,
    },
    workspace: { name: lease.property.label, ownerName: lease.landlord.name, role: 'locataire' },
    counts: {
      loyers: state.installments.filter((item) => item.status === 'impaye').length,
      messages: state.home.messages.filter((message) => message.state === 'a_repondre').length,
      interventions: state.interventions.filter((item) => item.status !== 'terminee').length,
    },
    notifications: state.notifications,
  };
}

export function compteOps(state: DemoState) {
  return {
    home: () => run(() => state.home),
    profile: () => run(() => state.profile),
    preferences: () => run(() => state.preferences),
    security: () => run(() => state.security),
    shell: () => run(() => shellOf(state)),
    markAllNotificationsRead: () =>
      run(() => {
        state.notifications = state.notifications.map((item) => ({ ...item, unread: false }));
      }),
    markNotificationRead: (id: string) =>
      run(() => {
        if (!state.notifications.some((item) => item.id === id)) {
          throw new SourceError('introuvable', 'Notification inconnue.');
        }
        state.notifications = state.notifications.map((item) => (item.id === id ? { ...item, unread: false } : item));
      }),
    updateProfile: (input: { values: ProfileInput; code?: string }) =>
      run(() => {
        const values = profileInputSchema.parse(input.values);
        const contactChanged = values.email !== state.profile.email || values.mobile !== state.profile.mobile;
        if (contactChanged && input.code !== DEMO_CONFIRMATION_CODE) {
          throw new SourceError('code_invalide', 'Le code de confirmation est incorrect.');
        }
        state.profile = { ...state.profile, ...values };
        return state.profile;
      }),
    setPreference: (input: PreferenceInput) =>
      run(() => {
        const values = preferenceInputSchema.parse(input);
        const preference = state.preferences.find((candidate) => candidate.id === values.id);
        if (!preference) throw new SourceError('introuvable', 'Préférence inconnue.');
        preference[values.channel] = values.enabled;
        return state.preferences;
      }),
    requestDataExport: () =>
      run(() => {
        state.profile.dataExportRequestedOn = state.today;
        return state.profile;
      }),
  };
}
