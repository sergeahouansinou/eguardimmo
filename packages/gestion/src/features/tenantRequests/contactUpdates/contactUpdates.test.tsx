import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { IDS, cursorPage } from '../testing/fixtures';
import { orgUrl, problem, renderTenantRequests } from '../testing/render';
import type { MockRoute } from '../testing/render';
import { createApiContactUpdatesSource } from './api';
import { ContactUpdatesCard } from './ContactUpdatesCard';
import { UPDATE_IDS, updateApplied, updateDismissed, updatePending } from './fixtures';
import { ContactUpdatesSourceProvider, useContactUpdatesSource } from './source';

const SLOW = { timeout: 4000 };
const listUrl = orgUrl(`/parties/${IDS.partyAwa}/contact-updates`);
const applyUrl = `${listUrl}/${UPDATE_IDS.pending}/apply`;
const dismissUrl = `${listUrl}/${UPDATE_IDS.pending}/dismiss`;

function renderCard(routes: Record<string, MockRoute>, options: { role?: string | null } = {}) {
  return renderTenantRequests(
    (context) => (
      <ContactUpdatesSourceProvider source={createApiContactUpdatesSource(context)}>
        <ContactUpdatesCard partyId={IDS.partyAwa} />
      </ContactUpdatesSourceProvider>
    ),
    routes,
    options,
  );
}

const listRoute = (items: readonly unknown[] = [updatePending, updateApplied, updateDismissed]): Record<string, MockRoute> => ({ [`GET ${listUrl}`]: { body: cursorPage(items) } });

describe('demandes de modification de coordonnées', () => {
  it('affiche les valeurs proposées d’une demande en attente et masque les actions des demandes traitées', async () => {
    const { container } = renderCard(listRoute());
    expect(await screen.findByText('E-mail : awa.diallo@example.test', {}, SLOW)).toBeTruthy();
    expect(screen.getByText('Téléphone : +33612345678')).toBeTruthy();
    expect(screen.getAllByText('Valeurs effacées après la décision')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Appliquer la demande de modification' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Écarter la demande de modification' })).toHaveLength(1);
    await expectNoA11yViolations(container);
  });

  it('applique la demande après confirmation', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderCard({ ...listRoute([updatePending]), [`POST ${applyUrl}`]: { body: { data: updateApplied } } });
    await user.click(await screen.findByRole('button', { name: 'Appliquer la demande de modification' }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: 'Appliquer cette demande ?' });
    expect(within(dialog).getByText(/deviennent la coordonnée principale/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Appliquer' }));
    await waitFor(() => { expect(callsTo('POST', applyUrl)).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', applyUrl)[0]?.body).toEqual({});
  });

  it('écarte la demande après confirmation', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderCard({ ...listRoute([updatePending]), [`POST ${dismissUrl}`]: { body: { data: updateDismissed } } });
    await user.click(await screen.findByRole('button', { name: 'Écarter la demande de modification' }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: 'Écarter cette demande ?' });
    await user.click(within(dialog).getByRole('button', { name: 'Écarter' }));
    await waitFor(() => { expect(callsTo('POST', dismissUrl)).toHaveLength(1); }, SLOW);
  });

  it('traduit le 409 d’une demande déjà traitée', async () => {
    const user = userEvent.setup();
    renderCard({ ...listRoute([updatePending]), [`POST ${applyUrl}`]: problem(409, 'contact_update_not_pending', 'English detail') });
    await user.click(await screen.findByRole('button', { name: 'Appliquer la demande de modification' }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: 'Appliquer cette demande ?' });
    await user.click(within(dialog).getByRole('button', { name: 'Appliquer' }));
    expect(await within(dialog).findByText(/a déjà été traitée/, {}, SLOW)).toBeTruthy();
    expect(within(dialog).queryByText('English detail')).toBeNull();
  });

  it('traduit le 404 et le 429', async () => {
    const user = userEvent.setup();
    renderCard({ ...listRoute([updatePending]), [`POST ${applyUrl}`]: problem(404, 'contact_update_not_found', 'English detail'), [`POST ${dismissUrl}`]: problem(429, 'rate_limited', 'English detail') });
    await user.click(await screen.findByRole('button', { name: 'Appliquer la demande de modification' }, SLOW));
    const apply = await screen.findByRole('dialog', { name: 'Appliquer cette demande ?' });
    await user.click(within(apply).getByRole('button', { name: 'Appliquer' }));
    expect(await within(apply).findByText(/n’existe pas pour ce locataire/, {}, SLOW)).toBeTruthy();
    await user.click(within(apply).getByRole('button', { name: 'Annuler' }));
    await user.click(await screen.findByRole('button', { name: 'Écarter la demande de modification' }, SLOW));
    const dismiss = await screen.findByRole('dialog', { name: 'Écarter cette demande ?' });
    await user.click(within(dismiss).getByRole('button', { name: 'Écarter' }));
    expect(await within(dismiss).findByText(/Trop de requêtes/, {}, SLOW)).toBeTruthy();
  });

  it('ne s’affiche pas et n’appelle rien pour le comptable', async () => {
    const { calls, container } = renderCard(listRoute(), { role: 'accountant' });
    await waitFor(() => { expect(container.textContent).toBe(''); });
    expect(calls.filter((call) => call.path === listUrl)).toHaveLength(0);
  });

  it('affiche l’état vide et l’erreur de chargement', async () => {
    const empty = renderCard(listRoute([]));
    expect(await screen.findByText(/Aucune demande/, {}, SLOW)).toBeTruthy();
    empty.unmount();
    renderCard({ [`GET ${listUrl}`]: problem(500, 'server_error') });
    expect(await screen.findByText('Impossible de charger les demandes de modification', { exact: false }, SLOW)).toBeTruthy();
  });

  it('lève en mode api quand la source n’est pas montée', () => {
    function Probe() {
      useContactUpdatesSource();
      return null;
    }
    expect(() => renderTenantRequests(() => <Probe />, {})).toThrow(/Aucune source/);
  });
});
