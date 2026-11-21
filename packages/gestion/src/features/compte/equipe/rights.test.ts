import { describe, expect, it } from 'vitest';
import { RIGHT_AREAS, ROLES, ROLE_RIGHTS, ROLE_SUMMARIES } from './schemas';

describe('matrice des droits de l’équipe', () => {
  it('couvre chaque domaine pour chaque rôle', () => {
    ROLES.forEach((role) => {
      expect(ROLE_RIGHTS[role]).toHaveLength(RIGHT_AREAS.length);
    });
  });

  it('donne à l’administrateur les mêmes droits qu’au titulaire, clôture comprise', () => {
    expect(ROLE_RIGHTS.administrateur).toEqual(ROLE_RIGHTS.titulaire);
    expect(ROLE_RIGHTS.administrateur[RIGHT_AREAS.indexOf('Reversements, banque, clôture')]).toBe('modifier-2fa');
    expect(ROLE_SUMMARIES.administrateur).not.toMatch(/sauf/i);
  });

  it('limite le gestionnaire à la préparation des reversements et le comptable à la lecture des biens', () => {
    const payouts = RIGHT_AREAS.indexOf('Reversements, banque, clôture');
    expect(ROLE_RIGHTS.gestionnaire[payouts]).toBe('preparation');
    expect(ROLE_RIGHTS.comptable[RIGHT_AREAS.indexOf('Biens, locataires, baux')]).toBe('lecture');
  });

  it('refuse au comptable la publication des comptes rendus et la messagerie locataire', () => {
    expect(ROLE_RIGHTS.comptable[RIGHT_AREAS.indexOf('Comptes rendus : publication')]).toBe('aucun');
    expect(ROLE_RIGHTS.comptable[RIGHT_AREAS.indexOf('Messages aux locataires')]).toBe('aucun');
  });

  it('donne la lecture de l’équipe au gestionnaire et au comptable', () => {
    const team = RIGHT_AREAS.indexOf('Équipe et réglages');
    expect(ROLE_RIGHTS.gestionnaire[team]).toBe('lecture');
    expect(ROLE_RIGHTS.comptable[team]).toBe('lecture');
  });

  it('ne connaît plus de rôle assistante', () => {
    expect([...ROLES]).toEqual(['titulaire', 'administrateur', 'gestionnaire', 'comptable']);
  });
});
