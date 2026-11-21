import { describe, expect, it } from 'vitest';
import * as api from './api/fixtures';
import { actorText, subjectHref, subjectTypeLabel } from './labels';

describe('libellés du journal', () => {
  it('ne lie que les fiches qui existent dans l’application', () => {
    expect(subjectHref({ type: 'lease', id: api.IDS.lease })).toBe(`/baux/${api.IDS.lease}`);
    expect(subjectHref({ type: 'party', id: api.IDS.party })).toBe(`/contacts/${api.IDS.party}`);
    expect(subjectHref({ type: 'planning_task', id: api.IDS.task })).toBe(`/taches/${api.IDS.task}`);
    expect(subjectHref({ type: 'unit', id: 'x' })).toBe('/biens/x');
    expect(subjectHref({ type: 'invoice', id: 'x' })).toBeNull();
  });

  it('nomme les types inconnus sans exposer de tiret bas', () => {
    expect(subjectTypeLabel('lease')).toBe('Bail');
    expect(subjectTypeLabel('lease_party')).toBe('lease party');
  });

  it('remplace un auteur sans nom par sa nature et signale un compte inactif', () => {
    expect(actorText({ kind: 'system', id: null, name: null, active: null })).toBe('Système');
    expect(actorText({ kind: 'member', id: 'a', name: 'Alex', active: false })).toBe('Alex (compte supprimé ou désactivé)');
  });
});
