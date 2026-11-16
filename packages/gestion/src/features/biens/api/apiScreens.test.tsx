import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { createApiBiensSource } from './apiSource';
import { LotCompteurs, LotDiagnostics, LotFinances, EquipementsScreen, InventairesScreen, RelevesScreen } from '../gatedPages';
import { createDemoBiensSource } from '../demo/store';
import { ImmeublesScreen } from '../screens/immeubles/ImmeublesScreen';
import { LotFiche } from '../screens/lots/LotFiche';
import { LotForm } from '../screens/lots/LotForm';
import { LotOverview } from '../screens/lots/LotOverview';
import { LotsScreen } from '../screens/lots/LotsScreen';
import { renderBiens } from '../testing/harness';
import * as api from './responses.fixtures';
import { org, readRoutes } from './support';
import { mockApi } from './testing';
import type { MockRoute } from './testing';

function renderWith(routes: Record<string, MockRoute>, ui: React.ReactElement, pathname = '/biens') {
  const mock = mockApi(routes);
  const source = createApiBiensSource({ client: mock.client, organizationId: api.IDS.org });
  return { ...renderBiens(ui, { source, pathname }), ...mock };
}

const leaseRoutes = (): Record<string, MockRoute> => ({
  [`GET ${org('/leases')}`]: { body: api.pageOf('/leases', []) },
  [`GET ${org(`/units/${api.IDS.unit}/ownerships`)}`]: { body: { data: [api.ownership] } },
});

describe('liste des lots en mode API', () => {
  it('affiche les vrais lots, sans colonne Annonce ni actions sans route serveur', async () => {
    renderWith(readRoutes(), <LotsScreen />);
    const table = await screen.findByRole('table', { name: 'Liste des lots' });
    expect(screen.queryByRole('button', { name: 'En travaux' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Loué' })).toBeTruthy();
    expect(within(table).getByRole('link', { name: 'A12' }).getAttribute('href')).toBe(`/biens/${api.IDS.unit}`);
    expect(within(table).getByText('Awa Diallo')).toBeTruthy();
    expect(within(table).queryByRole('button', { name: 'Annonce' })).toBeNull();
    expect(screen.getByRole('tab', { name: /Lots\s*3/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Archivés\s*1/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Importer' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Autres actions, A12' }));
    const menu = await screen.findAllByRole('menuitem');
    const labels = menu.map((item) => item.textContent);
    expect(labels).toContain('Archiver');
    expect(labels).not.toContain('Dupliquer');
    expect(labels).not.toContain('Supprimer');
    expect(labels.some((label) => label.includes('annonce'))).toBe(false);
  });

  it('archive un lot via le serveur puis recharge la liste', async () => {
    const routes = readRoutes();
    routes[`POST ${org(`/units/${api.IDS.unit}/archive`)}`] = { body: api.detail({ ...api.unitDetail, archived_at: '2026-11-16T10:00:00+00:00' }) };
    const { callsTo } = renderWith(routes, <LotsScreen />);
    await screen.findByRole('table', { name: 'Liste des lots' });
    await userEvent.click(screen.getByRole('button', { name: 'Autres actions, A12' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Archiver' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Archiver' }));
    await waitFor(() => { expect(callsTo('POST', org(`/units/${api.IDS.unit}/archive`))).toHaveLength(1); });
    await waitFor(() => { expect(callsTo('GET', org('/units')).length).toBeGreaterThan(2); });
  });

  it('ne présente aucune violation d’accessibilité', async () => {
    const { container } = renderWith(readRoutes(), <LotsScreen />);
    await screen.findByRole('table', { name: 'Liste des lots' });
    await expectNoA11yViolations(container);
  });
});

describe('fiche d’un lot en mode API', () => {
  const routes = () => ({ ...readRoutes(), ...leaseRoutes(), [`GET ${org(`/leases/${api.IDS.lease}`)}`]: { body: api.detail(api.leaseCurrent) } });

  it('ne montre aucune carte alimentée par la démo sur la vue d’ensemble', async () => {
    renderWith(routes(), <LotOverview id={api.IDS.unit} />, `/biens/${api.IDS.unit}`);
    expect(await screen.findByText('Historique d’occupation')).toBeTruthy();
    expect(screen.getByText('En bref')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Diagnostics' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Équipements' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Suivi' })).toBeNull();
    expect(screen.queryByText('Photos')).toBeNull();
  });

  it('remplace les onglets sans route par « Bientôt disponible » sans appeler le serveur', async () => {
    const { calls } = renderWith({}, (
      <>
        <LotDiagnostics id={api.IDS.unit} />
        <LotCompteurs id={api.IDS.unit} />
        <LotFinances id={api.IDS.unit} />
      </>
    ));
    expect(await screen.findAllByText('Bientôt disponible')).toHaveLength(3);
    expect(screen.getByText(/Diagnostics : cette fonction n’est pas encore reliée au serveur/)).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('ne compte pas ce que le serveur ne fournit pas dans les onglets', async () => {
    renderWith(routes(), <LotFiche id={api.IDS.unit}><p>contenu</p></LotFiche>, `/biens/${api.IDS.unit}`);
    expect(await screen.findByRole('heading', { name: 'A12' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Diagnostics' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Documents' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Voir le bail' }).getAttribute('href')).toBe(`/baux/${api.IDS.lease}`);
  });

  it('indique qu’un identifiant de démonstration est introuvable', async () => {
    const { calls } = renderWith({}, <LotFiche id="apt-a1"><p>contenu</p></LotFiche>);
    expect(await screen.findByText('Ce lot est introuvable')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });
});

describe('formulaire de lot en mode API', () => {
  const created = { ...api.unitDetail, id: '01935b20-0000-7000-8000-0000000000aa', reference: 'B07' };

  it('crée le lot avec les valeurs du serveur et ne propose que ce qu’il enregistre', async () => {
    const routes = { ...readRoutes(), [`POST ${org('/units')}`]: { status: 201, body: api.detail(created) } };
    const { push, callsTo } = renderWith(routes, <LotForm />, '/biens/nouveau');
    await userEvent.type(await screen.findByRole('textbox', { name: 'Nom du lot *' }), 'B07');
    await userEvent.click(screen.getByRole('combobox', { name: /Immeuble/ }));
    await userEvent.click(await screen.findByRole('option', { name: /Résidence du Port/ }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Surface, m² *' }), '54,35');

    expect(screen.queryByRole('textbox', { name: 'Loyer mensuel, € *' })).toBeNull();
    expect(screen.queryByText('Chauffage')).toBeNull();
    expect(screen.queryByText('Photos')).toBeNull();
    const address = screen.getByRole<HTMLInputElement>('textbox', { name: 'Adresse *' });
    expect(address.value).toBe('12 rue des Lilas');
    expect(address.readOnly).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le lot' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith(`/biens/${created.id}`); });
    expect(callsTo('POST', org('/units'))[0]?.body).toMatchObject({ property_id: api.IDS.property, reference: 'B07', surface_hundredths: 5435, unit_type_term_id: api.IDS.termApartment });
  });

  it('affiche le message « modifié entre-temps » sur un conflit de version', async () => {
    const routes = { ...readRoutes(), ...leaseRoutes(), [`PATCH ${org(`/units/${api.IDS.unit}`)}`]: { status: 409, body: api.staleUnitProblem } };
    const { push, callsTo } = renderWith(routes, <LotForm id={api.IDS.unit} />, `/biens/${api.IDS.unit}/modifier`);
    await screen.findByRole('textbox', { name: 'Nom du lot *' });
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    expect(await screen.findByText(/modifié entre-temps/)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    await waitFor(() => { expect(callsTo('GET', org(`/units/${api.IDS.unit}`)).length).toBeGreaterThanOrEqual(2); });
  });

  it('envoie les modifications avec la version lue', async () => {
    const routes = { ...readRoutes(), ...leaseRoutes(), [`PATCH ${org(`/units/${api.IDS.unit}`)}`]: { body: api.detail(api.unitDetail) } };
    const { push, callsTo } = renderWith(routes, <LotForm id={api.IDS.unit} />, `/biens/${api.IDS.unit}/modifier`);
    const name = await screen.findByRole('textbox', { name: 'Nom du lot *' });
    await userEvent.clear(name);
    await userEvent.type(name, 'A12 bis');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith(`/biens/${api.IDS.unit}`); });
    expect(callsTo('PATCH', org(`/units/${api.IDS.unit}`))[0]?.body).toMatchObject({ lock_version: 7, reference: 'A12 bis', floor: 3, surface_hundredths: 5435 });
  });
});

describe('immeubles et pages sans route en mode API', () => {
  it('liste les immeubles sans suppression ni montants inventés', async () => {
    renderWith(readRoutes(), <ImmeublesScreen />);
    const table = await screen.findByRole('table', { name: /immeubles/i });
    expect(within(table).getByText('Résidence du Port')).toBeTruthy();
    expect(within(table).getAllByText('—').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Autres actions, Résidence du Port' }));
    expect((await screen.findAllByRole('menuitem')).map((item) => item.textContent)).not.toContain('Supprimer');
  });

  it('remplace les écrans équipements, relevés et inventaires par « Bientôt disponible »', async () => {
    const { calls } = renderWith({}, (
      <>
        <EquipementsScreen />
        <RelevesScreen />
        <InventairesScreen />
      </>
    ));
    expect(await screen.findAllByText('Bientôt disponible')).toHaveLength(3);
    expect(calls).toHaveLength(0);
  });
});

describe('mode démo inchangé', () => {
  it('affiche les diagnostics de démonstration quand rien n’est indisponible', async () => {
    const source = createDemoBiensSource({ latencyMs: 0 });
    expect(source.unavailableInApiMode).toEqual([]);
    renderBiens(<LotDiagnostics id="apt-a1" />, { source, pathname: '/biens/apt-a1/diagnostics' });
    expect(await screen.findByRole('table')).toBeTruthy();
    expect(screen.queryByText('Bientôt disponible')).toBeNull();
  });
});
