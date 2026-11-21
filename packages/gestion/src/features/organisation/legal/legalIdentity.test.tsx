import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { LegalIdentityPage } from './LegalIdentityPage';
import * as fx from './api/responses.fixtures';
import { legalUrl, orgUrl } from './api/testing';
import { renderLegal } from './testing';

const routes = { [`GET ${orgUrl}`]: { body: fx.organization }, [`GET ${legalUrl}`]: { body: fx.identity } };

const field = (name: string | RegExp) => screen.getByRole<HTMLInputElement>('textbox', { name });

describe('page des réglages : identité légale', () => {
  it('affiche l’identité du serveur dans le formulaire, sans champ inconnu du serveur', async () => {
    const { container } = renderLegal(<LegalIdentityPage />, routes);

    await screen.findByRole('form', { name: 'Identité légale' });
    expect(field('Raison sociale *').value).toBe('Agence du Port SARL');
    expect(field('SIREN *').value).toBe('123456782');
    expect(field('Adresse *').value).toBe('12 rue du Port');
    expect(field('Capital social (€)').value).toBe('20000');
    expect(field('Montant de la garantie (€)').value).toBe('110000');
    expect(field('Délai de paiement (jours)').value).toBe('30');
    expect(screen.queryByRole('textbox', { name: /Téléphone|E-mail de contact/ })).toBeNull();
    expect(screen.queryByText('Identité légale non renseignée')).toBeNull();
    expect(document.body.textContent).not.toContain('Cabinet Delmas');
    await expectNoA11yViolations(container);
  });

  it('enregistre les modifications avec le contrat du serveur et confirme', async () => {
    const { callsTo } = renderLegal(<LegalIdentityPage />, { ...routes, [`PUT ${legalUrl}`]: { body: fx.identity } });
    await screen.findByRole('form', { name: 'Identité légale' });

    await userEvent.clear(field('Raison sociale *'));
    await userEvent.type(field('Raison sociale *'), 'Agence du Vieux-Port');
    await userEvent.clear(field('Capital social (€)'));
    await userEvent.type(field('Capital social (€)'), '25000,50');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => { expect(callsTo('PUT', legalUrl)).toHaveLength(1); });
    expect(callsTo('PUT', legalUrl)[0]?.body).toMatchObject({ legal_name: 'Agence du Vieux-Port', share_capital: 2500050, siren: '123456782', address: { line1: '12 rue du Port', postal_code: '13002', city: 'Marseille', country: 'FR' }, vat_regime: 'normal', payment_terms_days: 30 });
    expect(await screen.findByText('Identité légale enregistrée')).toBeTruthy();
  });

  it('bloque l’envoi et nomme les champs invalides', async () => {
    const { callsTo } = renderLegal(<LegalIdentityPage />, { ...routes, [`PUT ${legalUrl}`]: { body: fx.identity } });
    await screen.findByRole('form', { name: 'Identité légale' });

    await userEvent.clear(field('SIREN *'));
    await userEvent.type(field('SIREN *'), '123');
    await userEvent.clear(field('Ville *'));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Le SIREN comporte 9 chiffres.')).toBeTruthy();
    expect(screen.getByText('La ville est obligatoire.')).toBeTruthy();
    expect(callsTo('PUT', legalUrl)).toHaveLength(0);
  });

  it('affiche le refus du serveur sans perdre la saisie', async () => {
    renderLegal(<LegalIdentityPage />, { ...routes, [`PUT ${legalUrl}`]: { status: 422, body: fx.problemInvalidSiren } });
    await screen.findByRole('form', { name: 'Identité légale' });

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Enregistrement impossible')).toBeTruthy();
    expect(screen.getByText('Le SIREN comporte 9 chiffres.')).toBeTruthy();
    expect(field('SIREN *').value).toBe('123456782');
  });

  it('invite à renseigner une identité absente, avec le pays du siège par défaut', async () => {
    const { callsTo } = renderLegal(<LegalIdentityPage />, { ...routes, [`GET ${legalUrl}`]: { status: 404, body: fx.problemNotFound }, [`PUT ${legalUrl}`]: { body: fx.identityMinimal } });

    expect(await screen.findByText('Identité légale non renseignée')).toBeTruthy();
    expect(field('Pays *').value).toBe('FR');
    await userEvent.type(field('Raison sociale *'), 'Agence du Port SARL');
    await userEvent.type(field('SIREN *'), '123 456 782');
    await userEvent.type(field('Adresse *'), '12 rue du Port');
    await userEvent.type(field('Code postal *'), '13002');
    await userEvent.type(field('Ville *'), 'Marseille');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => { expect(callsTo('PUT', legalUrl)).toHaveLength(1); });
    expect(callsTo('PUT', legalUrl)[0]?.body).toMatchObject({ legal_name: 'Agence du Port SARL', siren: '123456782', siret: null, share_capital: null, vat_regime: 'normal', payment_terms_days: null });
  });

  it('passe en lecture seule pour un gestionnaire', async () => {
    const { container } = renderLegal(<LegalIdentityPage />, routes, { role: 'manager' });

    await screen.findByRole('form', { name: 'Identité légale' });
    expect(screen.getByText('Lecture seule')).toBeTruthy();
    expect(field('Raison sociale *').readOnly).toBe(true);
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull();
    await expectNoA11yViolations(container);
  });

  it('signale l’échec du chargement au lieu d’un formulaire vide', async () => {
    renderLegal(<LegalIdentityPage />, { ...routes, [`GET ${legalUrl}`]: { status: 503, body: { status: 503, code: 'service_unavailable', title: 'x', detail: 'x' } } });

    expect(await screen.findByText(/momentanément indisponible/)).toBeTruthy();
    expect(screen.queryByRole('form', { name: 'Identité légale' })).toBeNull();
  });

  it('affiche le chargement avant la réponse', () => {
    renderLegal(<LegalIdentityPage />, routes);

    expect(screen.getByRole('status', { name: 'Chargement de l’identité légale' })).toBeTruthy();
  });
});
