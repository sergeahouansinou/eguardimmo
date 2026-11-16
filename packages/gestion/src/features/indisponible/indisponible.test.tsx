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
    ['/', 'bureau'],
    ['/finances', 'finances'],
    ['/finances/impayes/abc/relance', 'finances'],
    ['/analytique/occupation', 'analytique'],
    ['/rapports/loyers/apercu', 'rapports'],
    ['/agenda/nouveau', 'agenda'],
    ['/taches/12/modifier', 'taches'],
    ['/interventions/12', 'interventions'],
    ['/contacts/12/modifier', 'contacts'],
    ['/journal', 'journal'],
    ['/documents', 'documents'],
    ['/documents/nouveau', 'documents'],
    ['/compte', 'compte'],
    ['/compte/abonnement', 'compte'],
    ['/compte/export', 'compte'],
    ['/reglages/notifications', 'reglages'],
    ['/reglages/menu/', 'reglages'],
    ['/finances?mois=2026-11', 'finances'],
  ] as const)('%s est indisponible (%s) en mode api', (path, family) => {
    expect(unavailableFamilyOf(path)).toBe(family);
  });

  it.each([
    '/messages',
    '/messages/12',
    '/campagnes/nouvelle',
    '/aide/support',
    '/notifications',
    '/equipe/inviter',
    '/locataires/candidats/12',
    '/baux/etats-des-lieux',
    '/biens/immeubles/12/lots',
    '/compte/securite',
    '/modeles/12',
    '/documents/quittances/12',
    '/documents/avis-echeance',
    '/documents/courriers/nouveau',
    '/documents/signatures/nouvelle',
    '/documents/attestations/12',
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
