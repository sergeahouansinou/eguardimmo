import { render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';
import { GATED_FAMILIES, classifyRoute, familyHasApiSource, unavailableFamilyOf } from './capabilities';
import { FamilyUnavailable } from './FamilyUnavailable';

function TestLink({ children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a {...props}>{children}</a>;
}

describe('table des familles sans source API', () => {
  it.each([
    ['/finances', 'finances'],
    ['/finances/impayes/abc/relance', 'finances'],
    ['/analytique/inconnu', 'analytique'],
    ['/analytique/occupation/extra', 'analytique'],
    ['/rapports/loyers/apercu', 'rapports'],
    ['/interventions/12/modifier', 'interventions'],
    ['/documents/nouveau', 'documents'],
    ['/documents/ajout', 'documents'],
    ['/compte/abonnement', 'compte'],
    ['/compte/inconnu', 'compte'],
    ['/compte/export', 'compte'],
    ['/reglages/menu/', 'reglages'],
    ['/finances?mois=2026-11', 'finances'],
    ['/finances/encaissements/acompte', 'finances'],
    ['/finances/encaissements', 'finances'],
    ['/finances/impayes/abc/grand-livre', 'finances'],
    ['/finances/factures', 'finances'],
    ['/finances/bilan', 'finances'],
    ['/finances/prets/abc/extra', 'finances'],
    ['/finances/cout-de-revient/extra', 'finances'],
    ['/finances/fiscalite/abc/extra', 'finances'],
    ['/finances/regularisation/extra', 'finances'],
    ['/finances/cloture', 'finances'],
    ['/reglages', 'reglages'],
    ['/rapports', 'rapports'],
    ['/finances/loyers-x', 'finances'],
    ['/support/12/extra', 'autre'],
    ['/reglages/acces-support/extra', 'reglages'],
  ] as const)('%s est indisponible (%s) en mode api', (path, family) => {
    expect(unavailableFamilyOf(path)).toBe(family);
  });

  it.each([
    '/',
    '/documents',
    '/documents/?x=1',
    '/conformite',
    '/analytique',
    '/analytique/revenus-depenses',
    '/analytique/occupation',
    '/analytique/rentabilite',
    '/analytique/previsionnel',
    '/finances/prets',
    '/finances/prets/0198e000-0000-7000-8000-000000000001',
    '/finances/cout-de-revient',
    '/finances/fiscalite',
    '/finances/fiscalite/0198e000-0000-7000-8000-000000000001',
    '/conformite/12',
    '/messages',
    '/messages/12',
    '/campagnes/nouvelle',
    '/aide/support',
    '/support',
    '/support/',
    '/support/nouvelle',
    '/support/0193a5e1-0000-7000-8000-000000000001',
    '/reglages/acces-support',
    '/reglages/fuseau-horaire',
    '/agenda',
    '/agenda/nouveau',
    '/agenda/12/modifier',
    '/taches',
    '/taches/12',
    '/contacts/12/modifier',
    '/journal',
    '/notifications',
    '/equipe/inviter',
    '/locataires/candidats/12',
    '/baux/etats-des-lieux',
    '/biens/immeubles/12/lots',
    '/compte',
    '/compte/',
    '/compte?x=1',
    '/compte/securite',
    '/reglages/notifications',
    '/modeles/12',
    '/documents/quittances/12',
    '/documents/avis-echeance',
    '/documents/courriers/nouveau',
    '/documents/signatures/nouvelle',
    '/documents/attestations/12',
    '/finances/impayes',
    '/finances/impayes/',
    '/finances/impayes?lease=12',
    '/finances/impayes/12',
    '/interventions',
    '/interventions?statut=reported',
    '/interventions/nouvelle',
    '/interventions/prestataires',
    '/interventions/12',
    '/finances/encaissements/nouveau',
    '/finances/encaissements/nouveau?bail=12',
    '/finances/recouvrement',
    '/finances/recouvrement/12',
    '/finances/loyers',
    '/finances/loyers?statut=paid',
    '/finances/loyers/12',
    '/finances/loyers/paiements',
    '/finances/loyers/paiements/nouveau',
    '/finances/loyers/quittances',
    '/finances/loyers/quittances/12',
    '/finances/depenses',
    '/finances/depenses/nouvelle',
    '/finances/depenses/12',
    '/finances/charges',
    '/finances/charges/nouveau',
    '/finances/charges/12',
    '/finances/charges/decomptes/12',
    '/finances/charges/cles?bien=12',
    '/finances/banque',
    '/finances/banque?compte=12',
    '/finances/banque/comptes',
    '/finances/banque/releves/12',
    '/finances/banque/etats/12',
    '/finances/banque/import',
    '/finances/regularisation',
    '/finances/import-bancaire',
  ])('%s reste servi (écran réel ou garde propre)', (path) => {
    expect(unavailableFamilyOf(path)).toBeNull();
  });

  it('refuse par défaut une route qu’aucune règle ne classe', () => {
    expect(classifyRoute('/nouvelle-famille')).toBeNull();
    expect(unavailableFamilyOf('/nouvelle-famille')).toBe('autre');
  });

  it('ne confond pas un préfixe de segment (/finances-x n’est pas /finances)', () => {
    expect(classifyRoute('/finances-x')).toBeNull();
    expect(classifyRoute('/compte/securite-x')).toBe('compte');
  });

  it('couvre chaque famille de la table', () => {
    expect(Object.keys(familyHasApiSource).sort()).toEqual([...GATED_FAMILIES].sort());
  });
});

describe('FamilyUnavailable', () => {
  it('annonce « Bientôt disponible » avec un lien de retour', () => {
    render(<FamilyUnavailable family="finances" Link={TestLink} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Finances' })).toBeTruthy();
    expect(screen.getByText('Bientôt disponible')).toBeTruthy();
    expect(screen.getByText(/Aucune donnée d’exemple n’est affichée/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour à l’accueil' }).getAttribute('href')).toBe('/');
  });

  it('propose les sections réelles et pas de retour vers lui-même sur l’accueil', () => {
    render(<FamilyUnavailable family="bureau" Link={TestLink} />);

    const nav = screen.getByRole('navigation', { name: 'Sections disponibles' });
    expect(within(nav).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/biens', '/locataires', '/baux', '/messages', '/equipe']);
    expect(screen.queryByRole('link', { name: 'Retour à l’accueil' })).toBeNull();
  });
});
