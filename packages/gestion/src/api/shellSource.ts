import type { ApiClient } from '@eguardimmo/api';
import type { OrganizationSession, ShellData } from '@eguardimmo/shell';
import { z } from 'zod';
import type { GestionSource } from '../data/source';

const meSchema = z.object({ data: z.object({ name: z.string().trim().min(1), email: z.email() }) });
const organizationSchema = z.object({ data: z.object({ name: z.string().trim().min(1) }) });

export const NOTIFICATIONS_UNAVAILABLE_MESSAGE = 'Les notifications ne sont pas encore reliées au serveur.';
export const BUREAU_UNAVAILABLE_MESSAGE = 'L’accueil n’est pas encore relié au serveur.';

function initialsOf(words: readonly string[]): string {
  const first = words[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1] ?? '') : '';
  return `${Array.from(first)[0] ?? ''}${Array.from(last)[0] ?? ''}`.toUpperCase();
}

function toShellData(me: unknown, organization: unknown, role: string): ShellData {
  const user = meSchema.parse(me).data;
  const workspace = organizationSchema.parse(organization).data;
  const words = user.name.split(/\s+/);
  return {
    user: { firstName: words[0] ?? user.name, fullName: user.name, initials: initialsOf(words), email: user.email },
    workspace: { name: workspace.name, role },
    counts: {},
    notifications: [],
  };
}

export function createApiShellSource(client: ApiClient, session: Pick<OrganizationSession, 'organization'>): GestionSource {
  const { organization: id, role } = session.organization;
  return {
    shell: async () => {
      const [me, organization] = await Promise.all([client.get('/api/v1/me'), client.get(`/api/v1/org/${encodeURIComponent(id)}`)]);
      return toShellData(me, organization, role);
    },
    markAllNotificationsRead: () => Promise.reject(new Error(NOTIFICATIONS_UNAVAILABLE_MESSAGE)),
    bureau: () => Promise.reject(new Error(BUREAU_UNAVAILABLE_MESSAGE)),
  };
}
