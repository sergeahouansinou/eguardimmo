import { describe, expect, it } from 'vitest';
import { paginate } from './common';
import { inviteInputSchema } from './equipe';
import { loginInputSchema } from './auth';
import { changePasswordInputSchema } from './parametres';
import { restoreFormSchema } from './sauvegardes';
import { suspendInputSchema } from './organisations';

describe('pagination', () => {
  const items = Array.from({ length: 17 }, (_, index) => index + 1);

  it('découpe en pages et donne le total', () => {
    const page = paginate(items, 2, 8);
    expect(page.rows).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
    expect(page.total).toBe(17);
  });

  it('ramène une page hors bornes à la dernière page', () => {
    expect(paginate(items, 99, 8).rows).toEqual([17]);
    expect(paginate([], 1, 8).rows).toEqual([]);
  });
});

describe('validation des entrées', () => {
  it('connexion : e-mail, mot de passe et code à 6 chiffres exigés', () => {
    expect(loginInputSchema.safeParse({ email: 'a@b.fr', password: 'x'.repeat(12), code: '123456' }).success).toBe(true);
    expect(loginInputSchema.safeParse({ email: 'a@b.fr', password: 'x'.repeat(12), code: '12' }).success).toBe(false);
    expect(loginInputSchema.safeParse({ email: 'nope', password: '', code: '' }).success).toBe(false);
  });

  it('changement de mot de passe : 6 caractères suffisent, sans composition, 5 sont refusés', () => {
    const change = (next: string) => changePasswordInputSchema.safeParse({ current: 'ancien', next, confirm: next });
    for (const accepted of ['123456', 'azerty', '!?-_*#', 'x'.repeat(255)]) expect(change(accepted).success).toBe(true);
    for (const refused of ['', '12345', '😀😀😀', 'x'.repeat(256)]) expect(change(refused).success).toBe(false);
    expect(change('azert').error?.issues.map((issue) => issue.message)).toEqual(['Au moins 6 caractères.']);
  });

  it('invitation : rôle limité à la liste blanche', () => {
    const base = { firstName: 'Camille', lastName: 'Martin', email: 'c@m.fr' };
    expect(inviteInputSchema.safeParse({ ...base, role: 'support' }).success).toBe(true);
    expect(inviteInputSchema.safeParse({ ...base, role: 'root' }).success).toBe(false);
  });

  it('suspension : motif obligatoire', () => {
    expect(suspendInputSchema.safeParse({ reason: '  ' }).success).toBe(false);
    expect(suspendInputSchema.safeParse({ reason: 'Impayé de plus de 60 jours' }).success).toBe(true);
  });

  it('restauration : référence de ticket au format attendu', () => {
    const base = { backupId: 'bk', scope: 'base', target: 'isole', reason: 'Test de restauration', validatorId: 'v' };
    expect(restoreFormSchema.safeParse({ ...base, ticket: '' }).success).toBe(true);
    expect(restoreFormSchema.safeParse({ ...base, ticket: 'SUP-2094' }).success).toBe(true);
    expect(restoreFormSchema.safeParse({ ...base, ticket: 'x' }).success).toBe(false);
  });
});
