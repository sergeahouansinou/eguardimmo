import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import * as api from './api/responses.fixtures';
import { BailEcheancierPage } from '../../baux/gatedPages';
import { LeaseSchedulePage } from './LeaseSchedulePage';
import { installmentsPage, leaseReference, rentUrl } from './testing';
import type { MockRoute } from './api/testing';
import { renderRent } from './testing';

const generatePath = rentUrl(`/leases/${api.IDS.lease}/installments/generate`);
const routes = (): Record<string, MockRoute> => ({
  [`GET ${rentUrl('/installments')}`]: { body: installmentsPage() },
  [`GET ${rentUrl(`/leases/${api.IDS.lease}/balance`)}`]: { body: api.balanceAdvance },
});

describe('échéancier d’un bail', () => {
  it('liste les échéances du bail lues sur le serveur, avec le solde du bail', async () => {
    const { callsTo, container } = renderRent(<LeaseSchedulePage id={api.IDS.lease} />, routes());

    const table = await screen.findByRole('table', { name: 'Échéances du bail' });
    expect(within(table).getAllByRole('columnheader').map((cell) => norm(cell.textContent))).toEqual(['Échéance', 'Période', 'Loyer', 'Charges', 'Total', 'Reste dû', 'Statut', 'Actions']);
    expect(norm(within(table).getAllByRole('row')[2]?.textContent)).toContain('Partiellement payée');
    const balance = await screen.findByRole('region', { name: 'Solde du bail' });
    expect(await within(balance).findByText('Avance du locataire')).toBeTruthy();
    expect(norm(balance.textContent)).toContain('Solde au grand livre-1 000 €');
    expect(callsTo('GET', rentUrl('/installments'))[0]?.search.get('lease')).toBe(api.IDS.lease);
    expect(screen.getByRole('heading', { level: 1, name: 'Échéancier' })).toBeTruthy();
    expect(screen.getByText(`Bail ${leaseReference}`)).toBeTruthy();
    expect(document.body.textContent).not.toContain('Sophie Delmas');
    await expectNoA11yViolations(container);
  });

  it('génère les échéances de ce bail sans demander de bail', async () => {
    const { callsTo } = renderRent(<LeaseSchedulePage id={api.IDS.lease} />, { ...routes(), [`POST ${generatePath}`]: { body: api.generation } });
    await screen.findByRole('table', { name: 'Échéances du bail' });

    await userEvent.click(screen.getByRole('button', { name: 'Générer les échéances' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Générer' }));

    await waitFor(() => { expect(callsTo('POST', generatePath)).toHaveLength(1); });
    expect(await screen.findByText('1 créée(s), 1 déjà existante(s).')).toBeTruthy();
  });

  it('masque la génération au comptable, qui peut enregistrer un paiement', async () => {
    renderRent(<LeaseSchedulePage id={api.IDS.lease} />, routes(), { role: 'accountant' });
    await screen.findByRole('table', { name: 'Échéances du bail' });

    expect(screen.queryByRole('button', { name: 'Générer les échéances' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Enregistrer un paiement' }).getAttribute('href')).toBe(`/finances/loyers/paiements/nouveau?bail=${api.IDS.lease}`);
  });

  it('filtre par statut côté serveur', async () => {
    const { callsTo } = renderRent(<LeaseSchedulePage id={api.IDS.lease} />, routes());
    await screen.findByRole('table', { name: 'Échéances du bail' });

    await userEvent.click(screen.getByRole('combobox', { name: /^Statut/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Payée' }));

    await waitFor(() => { expect(callsTo('GET', rentUrl('/installments')).some((call) => call.search.get('status') === 'paid')).toBe(true); });
  });

  it('traduit le refus du serveur sans afficher d’échéance', async () => {
    renderRent(<LeaseSchedulePage id={api.IDS.lease} />, {
      ...routes(),
      [`GET ${rentUrl('/installments')}`]: { status: 403, body: api.problemForbidden },
    });

    expect(await screen.findByText(/Action réservée|rôle ne permet pas/i)).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'Échéances du bail' })).toBeNull();
  });

  it('sert la page d’échéancier du bail depuis les loyers du serveur en mode api', async () => {
    const { callsTo } = renderRent(<BailEcheancierPage id={api.IDS.lease} />, routes());

    expect(await screen.findByRole('table', { name: 'Échéances du bail' })).toBeTruthy();
    expect(screen.queryByText('Bientôt disponible')).toBeNull();
    expect(callsTo('GET', rentUrl('/installments'))).not.toHaveLength(0);
  });

  it('signale un bail introuvable', async () => {
    renderRent(<LeaseSchedulePage id="01a1e544-3c7b-7316-ad15-a82486eff499" />, routes());

    expect(await screen.findByText('Ce bail n’existe pas')).toBeTruthy();
  });
});
