import { ApiError, createApiClient } from '@eguardimmo/api';
import type { ApiClient } from '@eguardimmo/api';
import { LOGIN_LOCK_SECONDS, loginInputSchema } from '../schemas';
import type { AuthApi } from '../source';
import { consoleOrigin } from './origin';

export function createApiAuth(client: ApiClient = createApiClient({ baseUrl: consoleOrigin() })): AuthApi {
  return {
    login: async (rawInput) => {
      const parsed = loginInputSchema.safeParse(rawInput);
      if (!parsed.success) return { status: 'invalid' };
      try {
        await client.post('/session', { email: parsed.data.email.trim(), password: parsed.data.password, code: parsed.data.code });
        return { status: 'ok' };
      } catch (error) {
        if (error instanceof ApiError && error.status === 422) return { status: 'invalid' };
        if (error instanceof ApiError && error.status === 429) return { status: 'locked', retryAfterSeconds: error.retryAfterSeconds ?? LOGIN_LOCK_SECONDS };
        throw error;
      }
    },
    signOut: async () => {
      await client.delete('/session');
    },
  };
}
