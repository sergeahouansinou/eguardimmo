import { LOGIN_LOCK_SECONDS, LOGIN_LOCK_THRESHOLD, loginInputSchema } from '../../schemas';
import type { AuthApi } from '../../source';
import type { DemoContext } from '../context';
import { DEMO_OPERATOR_CODE, DEMO_OPERATOR_EMAIL, DEMO_OPERATOR_PASSWORD } from '../credentials';

interface Attempts {
  failures: number;
  lockedUntil: number | null;
}

export interface DemoAuth extends AuthApi {
  verifyPassword: (password: string) => boolean;
  rotatePassword: (password: string) => void;
}

export function authApi(ctx: DemoContext): DemoAuth {
  const attempts = new Map<string, Attempts>();
  let password = DEMO_OPERATOR_PASSWORD;

  return {
    verifyPassword: (candidate) => candidate === password,
    rotatePassword: (next) => {
      password = next;
    },

    login: (rawInput) => {
      const parsed = loginInputSchema.safeParse(rawInput);
      if (!parsed.success) return Promise.resolve({ status: 'invalid' as const });
      const email = parsed.data.email.trim().toLowerCase();
      const now = ctx.clock().getTime();
      const entry = attempts.get(email) ?? { failures: 0, lockedUntil: null };

      if (entry.lockedUntil !== null && entry.lockedUntil > now) {
        return Promise.resolve({ status: 'locked' as const, retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000) });
      }
      if (entry.lockedUntil !== null) {
        entry.failures = 0;
        entry.lockedUntil = null;
      }

      const valid = email === DEMO_OPERATOR_EMAIL && parsed.data.password === password && parsed.data.code === DEMO_OPERATOR_CODE;
      if (valid) {
        attempts.delete(email);
        ctx.audit.record({ type: 'connexion', title: 'Connexion opérateur, 2FA validée', context: 'Console opérateur', action: 'Connexion', module: 'Console', request: 'POST /api/v1/console/auth/token' });
        return Promise.resolve({ status: 'ok' as const });
      }

      entry.failures += 1;
      attempts.set(email, entry);
      if (entry.failures >= LOGIN_LOCK_THRESHOLD) {
        entry.lockedUntil = now + LOGIN_LOCK_SECONDS * 1000;
        ctx.audit.record({
          type: 'securite',
          title: `${String(LOGIN_LOCK_THRESHOLD)} échecs de connexion`,
          context: 'Console opérateur, accès bloqué 15 min',
          action: 'Verrouillage',
          module: 'Console',
          request: 'POST /api/v1/console/auth/token',
          actor: { name: 'Système', role: 'Protection' },
          session: 'Aucune session',
        });
        return Promise.resolve({ status: 'locked' as const, retryAfterSeconds: LOGIN_LOCK_SECONDS });
      }
      return Promise.resolve({ status: 'invalid' as const });
    },

    signOut: () => {
      ctx.audit.record({ type: 'connexion', title: 'Déconnexion opérateur', context: 'Console opérateur', action: 'Déconnexion', module: 'Console', request: 'DELETE /api/v1/console/auth/token' });
      return Promise.resolve();
    },
  };
}
