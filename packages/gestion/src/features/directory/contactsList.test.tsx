import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { FIXTURE_CATEGORY, FIXTURE_OTHER_PARTY, FIXTURE_PARTY, FIXTURE_PROPERTY, FIXTURE_UNIT, cursorPageFixture, linkPageFixture, propertyLinkFixture, summaryFixture } from './api/fixtures';
import { ContactsPage } from './ContactsPage';
import { dirUrl, problem, renderDirectory } from './testing';
import { roleMatrix } from '../orgapi/testing';

const SLOW = { timeout: 4000 };
const list = `GET ${dirUrl('/parties')}`;
const ofProperty = `GET ${dirUrl(`/properties/${FIXTURE_PROPERTY}/contacts`)}`;

const rows = [
  summaryFixture(),
  summaryFixture({ id: FIXTURE_OTHER_PARTY, kind: 'person', display_name: 'Camille Dubois', primary_email: null, primary_phone: null, archived_at: '2026-11-01T10:00:00+00:00' }),
];

async function table() {
  const found = await screen.findByRole('table', { name: 'Contacts' }, SLOW);
  await waitFor(() => { expect(within(found).getByText('Plomberie Sanvi')).toBeTruthy(); }, SLOW);
  return found;
}

describe('liste des contacts', () => {
  it('affiche les contacts du serveur avec liens, coordonnées et statut', async () => {
    const { container, calls } = renderDirectory(<ContactsPage />, { [list]: { body: cursorPageFixture(rows) } });
    const found = await table();
    expect(within(found).getByRole('link', { name: 'Plomberie Sanvi' }).getAttribute('href')).toBe(`/contacts/${FIXTURE_PARTY}`);
    expect(within(found).getByText('contact@plomberie-sanvi.fr')).toBeTruthy();
    expect(within(found).getByText('Archivé')).toBeTruthy();
    expect(within(found).getByText('Société')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Nouveau contact' }).getAttribute('href')).toBe('/contacts/nouveau');
    expect(screen.getByRole('button', { name: 'Importer un CSV' })).toBeTruthy();
    expect(calls.find((call) => call.path === dirUrl('/parties'))?.search.get('status')).toBe('active');
    await expectNoA11yViolations(container);
  });

  it('transmet recherche, catégorie, type et statut au serveur et revient à la première page', async () => {
    const { calls } = renderDirectory(<ContactsPage />, { [list]: { body: cursorPageFixture(rows, 'suite') } });
    await table();
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    await waitFor(() => { expect(calls.some((call) => call.search.get('cursor') === 'suite')).toBe(true); }, SLOW);

    await userEvent.click(screen.getByRole('combobox', { name: /Catégorie/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Artisan' }));
    await waitFor(() => { expect(calls.some((call) => call.search.get('category') === FIXTURE_CATEGORY && call.search.get('cursor') === null)).toBe(true); }, SLOW);

    await userEvent.click(screen.getByRole('combobox', { name: /Statut/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Archivés' }));
    await waitFor(() => { expect(calls.some((call) => call.search.get('status') === 'archived')).toBe(true); }, SLOW);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un contact' }), 'sanvi');
    await waitFor(() => { expect(calls.some((call) => call.search.get('q') === 'sanvi')).toBe(true); }, SLOW);
  });

  it('explique l’absence de contact', async () => {
    renderDirectory(<ContactsPage />, { [list]: { body: cursorPageFixture([]) } });
    expect(await screen.findByText(/Aucun contact pour le moment/, {}, SLOW)).toBeTruthy();
  });

  it('affiche l’échec de chargement avec Réessayer, sans données inventées', async () => {
    let attempts = 0;
    renderDirectory(<ContactsPage />, { [list]: () => { attempts += 1; return attempts === 1 ? problem(500, 'server_error') : { body: cursorPageFixture(rows) }; } });
    expect(await screen.findByText(/Impossible de charger les contacts/, {}, SLOW)).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'Contacts' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await table();
  });

  it('un 403 du serveur est présenté comme un refus d’accès', async () => {
    renderDirectory(<ContactsPage />, { [list]: problem(403, 'role_forbidden') });
    expect(await screen.findByText('Accès refusé', {}, SLOW)).toBeTruthy();
  });

  it('un rôle sans lecture sur les contacts voit un refus et aucun appel de données', async () => {
    const matrix = roleMatrix('accountant');
    const { calls } = renderDirectory(<ContactsPage />, {}, { role: 'accountant', info: { roles: () => Promise.resolve({ ...matrix, domains: matrix.domains.filter((domain) => domain.key !== 'parties') }) } });
    expect(await screen.findByText('Accès refusé', {}, SLOW)).toBeTruthy();
    expect(calls.filter((call) => call.path === dirUrl('/parties'))).toHaveLength(0);
  });

  it('le comptable lit sans pouvoir créer ni importer', async () => {
    renderDirectory(<ContactsPage />, { [list]: { body: cursorPageFixture(rows) } }, { role: 'accountant' });
    await table();
    expect(screen.queryByRole('link', { name: 'Nouveau contact' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Importer un CSV' })).toBeNull();
  });

  it('le filtre par bien liste les liens du bien, avec le rôle et le lot', async () => {
    const { calls } = renderDirectory(
      <ContactsPage />,
      {
        [list]: { body: cursorPageFixture(rows) },
        [ofProperty]: { body: linkPageFixture([propertyLinkFixture({ property_name: null, unit_id: FIXTURE_UNIT, unit_reference: 'Apt 12' })], 'p2') },
      },
    );
    await table();
    await userEvent.click(screen.getByRole('combobox', { name: /Bien/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Résidence des Lilas' }));
    const found = await screen.findByRole('table', { name: 'Contacts du bien' }, SLOW);
    expect(within(found).getByRole('link', { name: 'Plomberie Sanvi' }).getAttribute('href')).toBe(`/contacts/${FIXTURE_PARTY}`);
    expect(within(found).getByText('Artisan')).toBeTruthy();
    expect(within(found).getByRole('link', { name: 'Apt 12' }).getAttribute('href')).toBe(`/biens/${FIXTURE_UNIT}`);
    expect(calls.some((call) => call.path === dirUrl(`/properties/${FIXTURE_PROPERTY}/contacts`))).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    await waitFor(() => { expect(calls.some((call) => call.search.get('cursor') === 'p2')).toBe(true); }, SLOW);
  });

  it('401 : la session expirée est signalée', async () => {
    renderDirectory(<ContactsPage />, { [list]: problem(401, 'unauthenticated') });
    expect(await screen.findByText(/Votre session a expiré/, {}, SLOW)).toBeTruthy();
  });
});
