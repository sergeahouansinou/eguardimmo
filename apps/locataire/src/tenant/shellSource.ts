import type { ApiClient } from '@eguardimmo/api';
import type { ShellData, ShellSource } from '@eguardimmo/shell';
import { fetchMe } from './requests';

export const NOTIFICATIONS_UNAVAILABLE_MESSAGE = 'Les notifications ne sont pas encore reliées au serveur.';
export const WORKSPACE_NAME = 'Espace locataire';
export const WORKSPACE_ROLE = 'locataire';

function initialsOf(words: readonly string[]): string {
  const first = words[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1] ?? '') : '';
  return `${Array.from(first)[0] ?? ''}${Array.from(last)[0] ?? ''}`.toUpperCase();
}

export function toShellData(me: { name: string; email: string }): ShellData {
  const words = me.name.split(/\s+/);
  return {
    user: { firstName: words[0] ?? me.name, fullName: me.name, initials: initialsOf(words), email: me.email },
    workspace: { name: WORKSPACE_NAME, role: WORKSPACE_ROLE },
    counts: {},
    notifications: [],
  };
}

export function createApiShellSource(client: ApiClient): ShellSource {
  return {
    shell: async () => toShellData(await fetchMe(client)),
    markAllNotificationsRead: () => Promise.reject(new Error(NOTIFICATIONS_UNAVAILABLE_MESSAGE)),
  };
}
