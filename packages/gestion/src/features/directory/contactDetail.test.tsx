import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import {
  FIXTURE_CATEGORY,
  FIXTURE_LINK,
  FIXTURE_PARTY,
  FIXTURE_POINT,
  FIXTURE_PROPERTY,
  FIXTURE_UNIT,
  contactPointFixture,
  detailFixture,
  linkPageFixture,
  propertyLinkFixture,
} from './api/fixtures';
import { ContactDetailPage } from './ContactDetailPage';
import { dirUrl, problem, renderDirectory } from './testing';
import type { MockRoute } from '../orgapi/testing';

const SLOW = { timeout: 4000 };
const party = dirUrl(`/parties/${FIXTURE_PARTY}`);
const baseRoutes = (detail = detailFixture(), links = linkPageFixture([propertyLinkFixture()])): Record<string, MockRoute> => ({
  [`GET ${party}`]: { body: { data: detail } },
  [`GET ${dirUrl('/property-contacts')}`]: { body: links },
});

async function loaded() {
  await screen.findByRole('heading', { level: 1, name: 'Plomberie Sanvi' }, SLOW);
}

describe('fiche d’un contact', () => {
  it('affiche identité, coordonnées, catégories, note en texte et biens liés', async () => {
    const note = '<img src=x onerror=alert(1)> Intervient sous 48 h';
    const { container } = renderDirectory(<ContactDetailPage id={FIXTURE_PARTY} />, baseRoutes(detailFixture({ note })));
    await loaded();
    expect(screen.getByText(note)).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('link', { name: 'Modifier' }).getAttribute('href')).toBe(`/contacts/${FIXTURE_PARTY}/modifier`);
    expect(screen.getByText('contact@plomberie-sanvi.fr')).toBeTruthy();
    expect(screen.getByText('Principal')).toBeTruthy();
    const classification = screen.getByRole('list', { name: 'Catégories et étiquettes' });
    expect(within(classification).getByText('Artisan')).toBeTruthy();
    expect(within(classification).getByText('Plomberie')).toBeTruthy();
    const links = await screen.findByRole('table', { name: 'Biens liés au contact' }, SLOW);
    expect(within(links).getByRole('link', { name: 'Résidence des Lilas' }).getAttribute('href')).toBe(`/biens/immeubles/${FIXTURE_PROPERTY}`);
    await expectNoA11yViolations(container);
  });

  it('nomme le lot par sa référence lisible, ou « Tout le bien » sans lot', async () => {
    const lot = propertyLinkFixture({ unit_id: FIXTURE_UNIT, unit_reference: 'Apt 12' });
    const bien = propertyLinkFixture({ id: '0198a0a0-0000-7000-8000-0000000000f9' });
    renderDirectory(<ContactDetailPage id={FIXTURE_PARTY} />, baseRoutes(detailFixture(), linkPageFixture([lot, bien])));
    await loaded();
    const links = await screen.findByRole('table', { name: 'Biens liés au contact' }, SLOW);
    expect(within(links).getByRole('link', { name: 'Apt 12' }).getAttribute('href')).toBe(`/biens/${FIXTURE_UNIT}`);
    expect(within(links).queryByRole('link', { name: 'Voir le lot' })).toBeNull();
    expect(within(links).getByText('Tout le bien')).toBeTruthy();
  });

  it('404 : fiche introuvable avec retour à la liste', async () => {
    renderDirectory(<ContactDetailPage id={FIXTURE_PARTY} />, { [`GET ${party}`]: problem(404, 'party_not_found') });
    expect(await screen.findByText('Contact introuvable', {}, SLOW)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour aux contacts' }).getAttribute('href')).toBe('/contacts');
  });

  it('échec de chargement : message et Réessayer', async () => {
    let attempts = 0;
    renderDirectory(<ContactDetailPage id={FIXTURE_PARTY} />, { ...baseRoutes(), [`GET ${party}`]: () => { attempts += 1; return attempts === 1 ? problem(500, 'server_error') : { body: { data: detailFixture() } }; } });
    expect(await screen.findByText(/Impossible de charger le contact/, {}, SLOW)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await loaded();
  });

  it('le comptable consulte sans aucune action d’écriture', async () => {
    renderDirectory(<ContactDetailPage id={FIXTURE_PARTY} />, baseRoutes(), { role: 'accountant' });
    await loaded();
    await screen.findByRole('table', { name: 'Biens liés au contact' }, SLOW);
    for (const name of [/Modifier/, /Ajouter une coordonnée/, /Rattacher à un bien/, /Archiver/, /Effacer/]) expect(screen.queryByRole('button', { name })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Modifier' })).toBeNull();
  });

  it('le gestionnaire archive mais n’efface pas les données personnelles', async () => {
    renderDirectory(<ContactDetailPage id={FIXTURE_PARTY} />, baseRoutes(), { role: 'manager' });
    await loaded();
    expect(screen.getByRole('button', { name: 'Archiver le contact' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Effacer les données personnelles' })).toBeNull();
  });

  it('un contact anonymisé est en lecture seule', async () => {
    renderDirectory(<ContactDetailPage id={FIXTURE_PARTY} />, baseRoutes(detailFixture({ is_anonymized: true, anonymized_at: '2026-11-21T10:00:00+00:00', note: null, contact_points: [] })));
    expect(await screen.findByText('Les données personnelles de cette fiche ont été effacées. Elle reste liée à l’historique des biens.', {}, SLOW)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Modifier' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Archiver|Effacer|Rattacher/ })).toBeNull();
  });
});

describe('archivage, restauration et effacement', () => {
  it('archive après confirmation puis recharge la fiche archivée', async () => {
    let archived = false;
    const { callsTo } = renderDirectory(<ContactDetailPage id={FIXTURE_PARTY} />, {
      ...baseRoutes(),
      [`GET ${party}`]: () => ({ body: { data: detailFixture(archived ? { archived_at: '2026-11-21T10:00:00+00:00' } : {}) } }),
      [`POST ${party}/archive`]: () => { archived = true; return { body: { data: detailFixture({ archived_at: '2026-11-21T10:00:00+00:00' }) } }; },
    });
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: 'Archiver le contact' }));
    expect(await screen.findByText('Archiver ce contact ?', {}, SLOW)).toBeTruthy();
    expect(callsTo('POST', `${party}/archive`)).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Archiver' }));
    await waitFor(() => { expect(callsTo('POST', `${party}/archive`)).toHaveLength(1); }, SLOW);
    expect(await screen.findByText('Archivé', {}, SLOW)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Restaurer le contact' })).toBeTruthy();
  });

  it('restaure un contact archivé', async () => {
    let restored = false;
    const { callsTo } = renderDirectory(<ContactDetailPage id={FIXTURE_PARTY} />, {
      ...baseRoutes(),
      [`GET ${party}`]: () => ({ body: { data: detailFixture(restored ? {} : { archived_at: '2026-11-21T10:00:00+00:00' }) } }),
      [`DELETE ${party}/archive`]: () => { restored = true; return { body: { data: detailFixture() } }; },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Restaurer le contact' }, SLOW));
    await waitFor(() => { expect(callsTo('DELETE', `${party}/archive`)).toHaveLength(1); }, SLOW);
    expect(await screen.findByRole('button', { name: 'Archiver le contact' }, SLOW)).toBeTruthy();
  });

  it('efface les données personnelles seulement après confirmation irréversible', async () => {
    const { callsTo } = renderDirectory(<ContactDetailPage id={FIXTURE_PARTY} />, {
      ...baseRoutes(),
      [`POST ${party}/anonymization`]: { body: { data: detailFixture({ is_anonymized: true }) } },
    });
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: 'Effacer les données personnelles' }));
    expect(await screen.findByText(/Cette action est irréversible/, {}, SLOW)).toBeTruthy();
    expect(callsTo('POST', `${party}/anonymization`)).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Effacer les données' }));
    await waitFor(() => { expect(callsTo('POST', `${party}/anonymization`)).toHaveLength(1); }, SLOW);
  });

  it.each([
    [403, 'role_forbidden', /Votre rôle ne permet pas cette action/],
    [404, 'party_not_found', /n’existe pas dans votre organisation/],
    [409, 'party_anonymized', /ne se modifie plus/],
    [429, 'too_many_requests', /Trop de requêtes/],
  ])('l’archivage refusé par le serveur (%i) laisse la fenêtre ouverte avec le motif', async (status, code, message) => {
    renderDirectory(<ContactDetailPage id={FIXTURE_PARTY} />, { ...baseRoutes(), [`POST ${party}/archive`]: problem(status, code) });
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: 'Archiver le contact' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Archiver' }, SLOW));
    expect(await screen.findByText(message, {}, SLOW)).toBeTruthy();
    expect(screen.getByText('Contact non archivé')).toBeTruthy();
  });
});

describe('coordonnées', () => {
  const points = `${party}/contact-points`;

  it('ajoute une coordonnée', async () => {
    const { callsTo } = renderDirectory(<ContactDetailPage id={FIXTURE_PARTY} />, {
      ...baseRoutes(),
      [`POST ${points}`]: { status: 201, body: { data: contactPointFixture({ type: 'phone', value: '+33612401877', is_primary: false }) } },
    });
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter une coordonnée' }));
    await userEvent.type(await screen.findByRole('textbox', { name: /^Coordonnée/ }, SLOW), 'rodrigue@exemple.fr');
    await userEvent.click(screen.getByRole('checkbox', { name: /principale/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => { expect(callsTo('POST', points)).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', points)[0]?.body).toEqual({ type: 'email', value: 'rodrigue@exemple.fr', label: null, is_primary: true });
  });

  it('modifie seulement ce qui a changé et signale un conflit serveur', async () => {
    const { callsTo } = renderDirectory(<ContactDetailPage id={FIXTURE_PARTY} />, {
      ...baseRoutes(),
      [`PATCH ${points}/${FIXTURE_POINT}`]: problem(409, 'contact_point_exists'),
    });
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: 'Modifier la coordonnée contact@plomberie-sanvi.fr' }));
    const value = await screen.findByDisplayValue('contact@plomberie-sanvi.fr', {}, SLOW);
    await userEvent.clear(value);
    await userEvent.type(value, 'nouveau@plomberie-sanvi.fr');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Ce contact porte déjà cette coordonnée.', {}, SLOW)).toBeTruthy();
    expect(callsTo('PATCH', `${points}/${FIXTURE_POINT}`)[0]?.body).toEqual({ value: 'nouveau@plomberie-sanvi.fr' });
  });

  it('refuse une adresse e-mail invalide sans appel serveur', async () => {
    const { callsTo } = renderDirectory(<ContactDetailPage id={FIXTURE_PARTY} />, baseRoutes());
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter une coordonnée' }));
    await userEvent.type(await screen.findByRole('textbox', { name: /^Coordonnée/ }, SLOW), 'pas-un-mail');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Adresse e-mail invalide.', {}, SLOW)).toBeTruthy();
    expect(callsTo('POST', `${party}/contact-points`)).toHaveLength(0);
  });
});

describe('biens liés', () => {
  const property = dirUrl(`/properties/${FIXTURE_PROPERTY}/contacts`);

  it('rattache le contact à un bien, un lot et un rôle', async () => {
    const { callsTo } = renderDirectory(<ContactDetailPage id={FIXTURE_PARTY} />, { ...baseRoutes(), [`POST ${property}`]: { status: 201, body: { data: propertyLinkFixture() } } });
    await loaded();
    await userEvent.click(await screen.findByRole('button', { name: 'Rattacher à un bien' }, SLOW));
    await userEvent.click(await screen.findByRole('combobox', { name: /Bien/ }, SLOW));
    await userEvent.click(await screen.findByRole('option', { name: 'Résidence des Lilas' }, SLOW));
    await userEvent.click(screen.getByRole('combobox', { name: /Lot/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Apt 12' }, SLOW));
    await userEvent.click(screen.getByRole('combobox', { name: /Rôle/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Artisan' }, SLOW));
    await userEvent.click(screen.getByRole('button', { name: 'Rattacher' }));
    await waitFor(() => { expect(callsTo('POST', property)).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', property)[0]?.body).toEqual({ party_id: FIXTURE_PARTY, unit_id: FIXTURE_UNIT, contact_category_id: FIXTURE_CATEGORY });
  });

  it('exige le choix du bien et affiche le doublon de lien du serveur', async () => {
    renderDirectory(<ContactDetailPage id={FIXTURE_PARTY} />, { ...baseRoutes(), [`POST ${property}`]: problem(409, 'property_contact_exists') });
    await loaded();
    await userEvent.click(await screen.findByRole('button', { name: 'Rattacher à un bien' }, SLOW));
    await userEvent.click(await screen.findByRole('button', { name: 'Rattacher' }, SLOW));
    expect(await screen.findByText('Choisissez le bien.', {}, SLOW)).toBeTruthy();
    await userEvent.click(screen.getByRole('combobox', { name: /Bien/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Résidence des Lilas' }, SLOW));
    await userEvent.click(screen.getByRole('button', { name: 'Rattacher' }));
    expect(await screen.findByText('Ce contact est déjà rattaché à ce bien ou à ce lot.', {}, SLOW)).toBeTruthy();
  });

  it('retire un lien après confirmation', async () => {
    const { callsTo } = renderDirectory(<ContactDetailPage id={FIXTURE_PARTY} />, { ...baseRoutes(), [`DELETE ${property}/${FIXTURE_LINK}`]: { status: 204 } });
    await userEvent.click(await screen.findByRole('button', { name: 'Retirer le lien avec Résidence des Lilas' }, SLOW));
    expect(await screen.findByText('Retirer ce lien ?', {}, SLOW)).toBeTruthy();
    expect(callsTo('DELETE', `${property}/${FIXTURE_LINK}`)).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Retirer le lien' }));
    await waitFor(() => { expect(callsTo('DELETE', `${property}/${FIXTURE_LINK}`)).toHaveLength(1); }, SLOW);
  });

  it('un 404 au retrait signale que le lien n’existe plus', async () => {
    renderDirectory(<ContactDetailPage id={FIXTURE_PARTY} />, { ...baseRoutes(), [`DELETE ${property}/${FIXTURE_LINK}`]: problem(404, 'property_contact_not_found') });
    await userEvent.click(await screen.findByRole('button', { name: 'Retirer le lien avec Résidence des Lilas' }, SLOW));
    await userEvent.click(screen.getByRole('button', { name: 'Retirer le lien' }));
    expect(await screen.findByText('Ce lien n’existe plus : rechargez la fiche.', {}, SLOW)).toBeTruthy();
  });

  it('état vide et échec de chargement des liens, sans bloquer le reste de la fiche', async () => {
    renderDirectory(<ContactDetailPage id={FIXTURE_PARTY} />, baseRoutes(detailFixture(), linkPageFixture([])));
    expect(await screen.findByText('Ce contact n’est rattaché à aucun bien.', {}, SLOW)).toBeTruthy();
  });

  it('échec de chargement des liens : la fiche reste visible', async () => {
    renderDirectory(<ContactDetailPage id={FIXTURE_PARTY} />, { ...baseRoutes(), [`GET ${dirUrl('/property-contacts')}`]: problem(500, 'server_error') });
    await loaded();
    expect(await screen.findByText(/Impossible de charger les biens liés/, {}, SLOW)).toBeTruthy();
    expect(screen.getByText('contact@plomberie-sanvi.fr')).toBeTruthy();
  });
});
