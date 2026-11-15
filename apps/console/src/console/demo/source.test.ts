import { shellSchema } from '@eguardimmo/shell';
import { describe, expect, it } from 'vitest';
import {
  ConsoleError,
  LOGIN_FAILURE_MESSAGE,
  LOGIN_LOCK_THRESHOLD,
  auditListSchema,
  equipeSchema,
  organisationDetailSchema,
  rgpdDetailSchema,
  sauvegardesSchema,
} from '../schemas';
import { createDemoSource } from './source';
import { DEMO_OPERATOR_CODE, DEMO_OPERATOR_EMAIL, DEMO_OPERATOR_PASSWORD } from './credentials';
import { DEMO_NOW } from './clock';

function newSource() {
  const fixed = new Date(DEMO_NOW);
  return createDemoSource({ clock: () => fixed });
}

async function auditCount(source: ReturnType<typeof newSource>): Promise<number> {
  return auditListSchema.parse(await source.audit.list({ pageSize: 1 })).total;
}

async function latestAuditTitle(source: ReturnType<typeof newSource>): Promise<string> {
  const list = auditListSchema.parse(await source.audit.list({ pageSize: 1 }));
  return list.rows[0]?.title ?? '';
}

describe('connexion opérateur', () => {
  it('accepte l’e-mail, le mot de passe et le code', async () => {
    const source = newSource();
    const result = await source.auth.login({ email: DEMO_OPERATOR_EMAIL, password: DEMO_OPERATOR_PASSWORD, code: DEMO_OPERATOR_CODE });
    expect(result.status).toBe('ok');
  });

  it('répond pareil pour un compte inexistant et pour un mauvais mot de passe', async () => {
    const source = newSource();
    const unknown = await source.auth.login({ email: 'inconnu@exemple.fr', password: 'un-mot-de-passe-long', code: '123456' });
    const wrong = await source.auth.login({ email: DEMO_OPERATOR_EMAIL, password: 'un-mot-de-passe-long', code: DEMO_OPERATOR_CODE });
    expect(unknown).toEqual({ status: 'invalid' });
    expect(wrong).toEqual(unknown);
    expect(LOGIN_FAILURE_MESSAGE).toBe('Identifiants ou code invalides.');
  });

  it('refuse un code faux même avec le bon mot de passe', async () => {
    const source = newSource();
    const result = await source.auth.login({ email: DEMO_OPERATOR_EMAIL, password: DEMO_OPERATOR_PASSWORD, code: '000000' });
    expect(result.status).toBe('invalid');
  });

  it('verrouille après le seuil d’échecs, même avec les bons identifiants, et le consigne', async () => {
    const source = newSource();
    const before = await auditCount(source);
    let last: Awaited<ReturnType<typeof source.auth.login>> = { status: 'invalid' };
    for (let attempt = 0; attempt < LOGIN_LOCK_THRESHOLD; attempt += 1) {
      last = await source.auth.login({ email: DEMO_OPERATOR_EMAIL, password: 'un-mot-de-passe-long', code: '000000' });
    }
    expect(last.status).toBe('locked');
    const afterGood = await source.auth.login({ email: DEMO_OPERATOR_EMAIL, password: DEMO_OPERATOR_PASSWORD, code: DEMO_OPERATOR_CODE });
    expect(afterGood.status).toBe('locked');
    expect(await auditCount(source)).toBe(before + 1);
  });

  it('traite une saisie mal formée comme un échec sans lever d’erreur', async () => {
    const source = newSource();
    const result = await source.auth.login({ email: 'pas-un-email', password: '', code: 'abc' });
    expect(result.status).toBe('invalid');
  });
});

describe('actions sensibles consignées au journal', () => {
  it('suspension d’organisation : ajoute un événement et change l’état', async () => {
    const source = newSource();
    const before = await auditCount(source);
    await source.organisations.suspend('cabinet-delmas-immobilier', { reason: 'Impayé de plus de 60 jours' });
    expect(await auditCount(source)).toBe(before + 1);
    expect(await latestAuditTitle(source)).toBe('Organisation suspendue');
    const detail = organisationDetailSchema.parse(await source.organisations.get('cabinet-delmas-immobilier'));
    expect(detail.organisation.state).toBe('suspendue');
  });

  it('suspension : motif trop court refusé, rien n’est écrit', async () => {
    const source = newSource();
    const before = await auditCount(source);
    expect(() => source.organisations.suspend('cabinet-delmas-immobilier', { reason: 'ok' })).toThrow();
    expect(await auditCount(source)).toBe(before);
  });

  it('suspension d’une organisation déjà suspendue : conflit', async () => {
    const source = newSource();
    await source.organisations.suspend('cabinet-delmas-immobilier', { reason: 'Fraude suspectée' });
    expect(() => source.organisations.suspend('cabinet-delmas-immobilier', { reason: 'Fraude suspectée' })).toThrow(ConsoleError);
  });

  it('organisation inconnue : introuvable', () => {
    const source = newSource();
    expect(() => source.organisations.get('n-existe-pas')).toThrow(/introuvable/);
  });

  it('invitation : ajoute l’opérateur en attente et consigne', async () => {
    const source = newSource();
    const before = await auditCount(source);
    await source.equipe.invite({ firstName: 'Camille', lastName: 'Martin', email: 'camille.martin@eguardimmo.example', role: 'finance' });
    const team = equipeSchema.parse(await source.equipe.list());
    expect(team.operators.some((operator) => operator.email === 'camille.martin@eguardimmo.example' && operator.state === 'invitation')).toBe(true);
    expect(await auditCount(source)).toBe(before + 1);
  });

  it('invitation : e-mail déjà utilisé refusé', () => {
    const source = newSource();
    expect(() => source.equipe.invite({ firstName: 'Inès', lastName: 'Garnier', email: 'ines.garnier@eguardimmo.example', role: 'support' })).toThrow(/existe déjà/);
  });

  it('équipe : on ne change pas son propre rôle ni son propre accès', () => {
    const source = newSource();
    expect(() => source.equipe.changeRole('lucas-bernard', { role: 'support' })).toThrow(/propre rôle/);
    expect(() => source.equipe.setActive('lucas-bernard', false)).toThrow(/propre accès/);
  });

  it('équipe : désactiver puis réactiver consigne deux événements', async () => {
    const source = newSource();
    const before = await auditCount(source);
    await source.equipe.setActive('theo-marchand', false);
    await source.equipe.setActive('theo-marchand', true);
    expect(await auditCount(source)).toBe(before + 2);
  });

  it('journal : l’événement est lisible mais l’API n’offre aucune écriture ni suppression', () => {
    const source = newSource();
    expect(Object.keys(source.audit).sort()).toEqual(['export', 'get', 'list']);
  });

  it('export du journal : consigné, avec une référence présente dans le journal', async () => {
    const source = newSource();
    const result = await source.audit.export({});
    expect(result.rows).toBeGreaterThan(0);
    expect(result.csv.split('\n').length).toBeGreaterThan(1);
    expect(await latestAuditTitle(source)).toMatch(/export/i);
  });
});

describe('modules', () => {
  it('activer un module active ses prérequis dans le plan : les prérequis sont déclarés', async () => {
    const source = newSource();
    const modules = (await source.modules.list({})) as { rows: { id: string; requires: string[] }[] };
    expect(modules.rows.some((row) => row.requires.length > 0)).toBe(true);
  });
});

describe('RGPD', () => {
  it('le workflow avance dans l’ordre et refuse de sauter une étape', async () => {
    const source = newSource();
    const before = rgpdDetailSchema.parse(await source.rgpd.get('paul-lemoine-effacement'));
    const next = before.steps.find((step) => step.doneOn === null);
    const later = before.steps.filter((step) => step.doneOn === null)[1];
    expect(next).toBeDefined();
    expect(later).toBeDefined();
    expect(() => source.rgpd.advance('paul-lemoine-effacement', later?.key ?? '')).toThrow(/prochaine/);
    const count = await auditCount(source);
    await source.rgpd.advance('paul-lemoine-effacement', next?.key ?? '');
    expect(await auditCount(source)).toBe(count + 1);
    const after = rgpdDetailSchema.parse(await source.rgpd.get('paul-lemoine-effacement'));
    expect(after.steps.find((step) => step.key === next?.key)?.doneOn).not.toBeNull();
  });
});

describe('sauvegardes : restauration', () => {
  async function context(source: ReturnType<typeof newSource>) {
    const data = sauvegardesSchema.parse(await source.sauvegardes.get());
    const backup = data.latest;
    return { backup, input: { backupId: backup.id, scope: 'base_documents', target: 'isole', reason: 'Test de restauration trimestriel', ticket: '', validatorId: 'theo-marchand', confirmation: backup.name } as const };
  }

  it('crée la demande et la consigne quand le nom saisi correspond', async () => {
    const source = newSource();
    const { input } = await context(source);
    const count = await auditCount(source);
    await source.sauvegardes.requestRestore(input);
    expect(await auditCount(source)).toBe(count + 1);
    const data = sauvegardesSchema.parse(await source.sauvegardes.get());
    expect(data.requests).toHaveLength(1);
  });

  it('refuse un nom de confirmation différent', async () => {
    const source = newSource();
    const { input } = await context(source);
    const count = await auditCount(source);
    expect(() => source.sauvegardes.requestRestore({ ...input, confirmation: 'autre-nom' })).toThrow(/ne correspond pas/);
    expect(await auditCount(source)).toBe(count);
  });

  it('refuse de se désigner comme second validateur', async () => {
    const source = newSource();
    const { input } = await context(source);
    expect(() => source.sauvegardes.requestRestore({ ...input, validatorId: 'lucas-bernard' })).toThrow(/autre opérateur/);
  });
});

describe('notifications de la console', () => {
  it('marque une notification comme lue, puis toutes, et refuse une notification inconnue', async () => {
    const source = newSource();
    const unread = async () => shellSchema.parse(await source.shell()).notifications.filter((item) => item.unread);
    const before = await unread();
    expect(before.length).toBeGreaterThan(1);
    const [first] = before;
    if (!first) throw new Error('aucune notification non lue');
    await source.markNotificationRead(first.id);
    expect(await unread()).toHaveLength(before.length - 1);
    await source.markAllNotificationsRead();
    expect(await unread()).toHaveLength(0);
    await expect(source.markNotificationRead('inconnue')).rejects.toThrow('inconnue');
  });
});
