import type { ApiClient } from '@eguardimmo/api';
import type { ShellData } from '@eguardimmo/shell';
import { z } from 'zod';
import { initials as initialsOf } from '@/lib/format';
import { translated } from './problems';

const meResponseSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    name: z.string().trim().min(1),
    email: z.email(),
  }),
});
export type ConsoleMe = z.infer<typeof meResponseSchema>['data'];

export const OPERATOR_WORKSPACE = { name: 'Équipe opérateur', role: 'operateur' } as const;

export const NOTIFICATIONS_UNAVAILABLE_MESSAGE = 'Les notifications ne sont pas encore reliées au serveur.';

export async function fetchMe(client: ApiClient): Promise<ConsoleMe> {
  return translated(async () => {
    const parsed = meResponseSchema.safeParse(await client.get('/api/v1/console/me'));
    if (!parsed.success) throw new Error('Réponse inattendue du serveur. Réessayez dans un instant.');
    return parsed.data.data;
  });
}

export function toShellData(me: ConsoleMe): ShellData {
  return {
    user: { firstName: me.name.split(/\s+/)[0] ?? me.name, fullName: me.name, initials: initialsOf(me.name), email: me.email },
    workspace: { ...OPERATOR_WORKSPACE },
    counts: {},
    notifications: [],
  };
}
