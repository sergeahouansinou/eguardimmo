import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { json, renderPlatform } from '../../../test/platform';
import { problem } from '@/platform/fixtures';
import { billingOverview, overviewResponse } from '@/platform/overview/fixtures';
import { AccueilScreen } from './AccueilScreen';

const section = (title: string): HTMLElement => {
  const found = screen.getByRole('heading', { level: 2, name: title }).closest('section');
  if (found === null) throw new Error(`Section introuvable : ${title}`);
  return found;
};
const findSection = async (title: string) => {
  await screen.findByRole('heading', { level: 2, name: title });
  return section(title);
};

describe('accueil de la console', () => {
  it('affiche les cinq sections d’un administrateur avec les chiffres du serveur, sans MRR ni montant', async () => {
    const view = renderPlatform(<AccueilScreen />, () => json(200, overviewResponse));

    const organizations = await findSection('Organisations');
    expect(within(organizations).getByText('42')).toBeTruthy();
    expect(within(section('Comptes')).getByText('310')).toBeTruthy();
    expect(within(section('Abonnements')).getByText('Essais finissant sous 7 jours')).toBeTruthy();
    expect(within(section('Support')).getByText('7')).toBeTruthy();
    expect(section('Conformité RGPD')).toBeTruthy();
    expect(screen.getByText(/Chiffres du .* en nombres de comptes uniquement/)).toBeTruthy();
    expect(screen.queryByText(/MRR|FCFA|€/)).toBeNull();
    expect(view.requests.map((request) => request.url.pathname)).toEqual(['/api/v1/console/overview']);
    await expectNoA11yViolations(view.container);
  });

  it('n’affiche que les sections servies à un rôle de facturation', async () => {
    renderPlatform(<AccueilScreen />, () => json(200, billingOverview));

    expect(await findSection('Organisations')).toBeTruthy();
    expect(section('Abonnements')).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2, name: 'Comptes' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: 'Support' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: 'Conformité RGPD' })).toBeNull();
  });

  it('signale qu’aucune section n’est servie quand le serveur n’en renvoie aucune', async () => {
    renderPlatform(<AccueilScreen />, () => json(200, { data: { generated_at: overviewResponse.data.generated_at } }));

    expect(await screen.findByText('Aucune section n’est servie pour votre rôle d’opérateur.')).toBeTruthy();
  });

  it('remplace l’accueil par les écrans d’exploitation quand le serveur répond 403 (rôle ingénierie)', async () => {
    const view = renderPlatform(<AccueilScreen />, () => json(403, problem(403, 'operator_role_required', 'Votre rôle d’opérateur ne permet pas cette opération.')));

    expect(await screen.findByText('Votre rôle n’a pas d’accueil')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Santé du système' }).getAttribute('href')).toBe('/sante');
    expect(screen.getByRole('link', { name: 'Sauvegardes' }).getAttribute('href')).toBe('/sauvegardes');
    expect(screen.getByRole('link', { name: 'Paramètres' }).getAttribute('href')).toBe('/parametres');
    expect(screen.queryByRole('heading', { level: 2, name: 'Organisations' })).toBeNull();
    await expectNoA11yViolations(view.container);
  });

  it('affiche l’erreur 429 avec le délai et se recharge par « Réessayer »', async () => {
    let calls = 0;
    renderPlatform(<AccueilScreen />, () => (++calls === 1 ? json(429, problem(429, 'too_many_requests', 'Trop de requêtes.'), { 'Retry-After': '9' }) : json(200, overviewResponse)));
    const user = userEvent.setup();

    expect(await screen.findByText(/Réessayez dans 9 s/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await findSection('Organisations')).toBeTruthy();
  });

  it('affiche une réponse invalide comme une erreur, sans chiffres inventés', async () => {
    renderPlatform(<AccueilScreen />, () => json(200, { data: { generated_at: 'hier' } }));

    expect(await screen.findByText('La vue d’ensemble n’a pas pu être chargé')).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2, name: 'Organisations' })).toBeNull();
  });

  it('propose le lien vers les approbations', async () => {
    renderPlatform(<AccueilScreen />, () => json(200, overviewResponse));

    expect((await screen.findByRole('link', { name: 'Approbations' })).getAttribute('href')).toBe('/approbations');
  });
});
