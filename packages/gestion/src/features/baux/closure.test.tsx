import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { FROZEN_NOW, renderLot } from '../../../test/lots';
import { BailSortiePage } from './BailSortiePage';
import { BauxPage } from './BauxPage';
import type { Lease } from './schemas';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN_NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

interface TenantRow { id: string; unitId: string | null; status: string; portalActive: boolean }
interface UnitRow { id: string; vacant: boolean }

const leasesOf = async (source: { leases: () => Promise<unknown> }) => (await source.leases()) as Lease[];
const tenantsOf = async (source: { tenants: () => Promise<unknown> }) => (await source.tenants()) as TenantRow[];
const unitsOf = async (source: { units: () => Promise<unknown> }) => (await source.units()) as UnitRow[];

async function restitute() {
  await screen.findByText('Décompte du dépôt', { selector: 'h2' });
  for (const title of ['État des lieux de sortie', 'Décompte du dépôt']) {
    const item = screen.getAllByText(title).map((node) => node.closest('li')).find(Boolean) as HTMLElement;
    await userEvent.click(within(item).getByRole('button', { name: 'Marquer comme fait' }));
    await waitFor(() => { expect(within(item).queryByRole('button', { name: 'Marquer comme fait' })).toBeNull(); });
  }
  await userEvent.click(screen.getByRole('button', { name: 'Marquer comme restitué' }));
  const dialog = await screen.findByRole('dialog');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Marquer comme restitué' }));
}

describe('Clôture de bail, cohérence inter-lots', () => {
  it('libère le bien et archive le locataire sans autre bail actif', async () => {
    const { sources, push } = renderLot(<BailSortiePage id="studio-b3" />);
    expect((await unitsOf(sources.tenants)).find((unit) => unit.id === 'studio-b3')?.vacant).toBe(false);
    await restitute();
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/documents/attestations/at-2026-0001'); });
    expect((await leasesOf(sources.baux)).find((lease) => lease.id === 'studio-b3')?.status).toBe('termine');
    expect((await unitsOf(sources.tenants)).find((unit) => unit.id === 'studio-b3')?.vacant).toBe(true);
    expect((await tenantsOf(sources.tenants)).find((tenant) => tenant.id === 'yann-le-gall')).toMatchObject({ unitId: null, status: 'archive', portalActive: false });
  });

  it('garde le locataire actif et le rattache à son autre bail', async () => {
    const { sources, push } = renderLot(<BailSortiePage id="studio-b3" />);
    await sources.baux.createLease({
      unitId: 'studio-plage',
      furnished: true,
      start: '2026-11-01',
      durationMonths: '12',
      tenantIds: ['yann-le-gall'],
      paymentMethod: 'virement',
      note: '',
      rent: '500',
      charges: '50',
      deposit: '500',
      dueDay: '5',
      asDraft: false,
    });
    await restitute();
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/documents/attestations/at-2026-0001'); });
    expect((await unitsOf(sources.tenants)).find((unit) => unit.id === 'studio-b3')?.vacant).toBe(true);
    const yann = (await tenantsOf(sources.tenants)).find((tenant) => tenant.id === 'yann-le-gall');
    expect(yann).toMatchObject({ unitId: 'studio-plage', status: 'actif' });
    expect((await unitsOf(sources.tenants)).find((unit) => unit.id === 'studio-plage')?.vacant).toBe(false);
  });

  it('ne touche ni au bien ni au locataire quand la restitution est refusée', async () => {
    const { sources } = renderLot(<BailSortiePage id="studio-b3" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Marquer comme restitué' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Marquer comme restitué' }));
    expect(await screen.findByText('Terminez l’état des lieux de sortie et le décompte du dépôt avant la restitution.')).toBeTruthy();
    expect((await unitsOf(sources.tenants)).find((unit) => unit.id === 'studio-b3')?.vacant).toBe(false);
    expect((await tenantsOf(sources.tenants)).find((tenant) => tenant.id === 'yann-le-gall')).toMatchObject({ unitId: 'studio-b3', status: 'actif' });
  });
});

describe('Menu des baux', () => {
  const choose = async (reference: string, item: string) => {
    await screen.findByRole('table', { name: 'Baux' });
    await userEvent.click(screen.getByRole('button', { name: `Plus d’actions, bail ${reference}` }));
    await userEvent.click(await screen.findByRole('menuitem', { name: item }));
  };

  it('ouvre l’encaissement, l’avis d’échéance et l’état des lieux du bail', async () => {
    const { push } = renderLot(<BauxPage />);
    await choose('BL-2024-0003', 'Enregistrer un paiement');
    expect(push).toHaveBeenLastCalledWith(expect.stringMatching(/^\/finances\/encaissements\/nouveau\?locataire=/));
    await choose('BL-2024-0003', 'Avis d’échéance');
    expect(push).toHaveBeenLastCalledWith('/documents/avis-echeance');
    await choose('BL-2024-0003', 'État des lieux');
    expect(push).toHaveBeenLastCalledWith('/baux/etats-des-lieux/nouveau?bien=apt-a3');
  });

  it('révise le loyer d’un bail en cours', async () => {
    const { sources, container } = renderLot(<BauxPage />);
    await choose('BL-2024-0003', 'Réviser le loyer');
    const dialog = await screen.findByRole('dialog');
    await expectNoA11yViolations(container);
    const field = within(dialog).getByLabelText('Nouveau loyer hors charges (€) *');
    await userEvent.clear(field);
    await userEvent.type(field, '812,50');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Réviser le loyer' }));
    await waitFor(async () => { expect((await leasesOf(sources.baux)).find((lease) => lease.id === 'apt-a3')?.rent).toBe(81250); });
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
  });

  it('refuse un loyer identique ou invalide et garde le dialogue ouvert', async () => {
    const { sources } = renderLot(<BauxPage />);
    const before = (await leasesOf(sources.baux)).find((lease) => lease.id === 'apt-a3')?.rent;
    await choose('BL-2024-0003', 'Réviser le loyer');
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Réviser le loyer' }));
    expect(await within(dialog).findByText('Le nouveau loyer est identique au loyer actuel.')).toBeTruthy();
    const field = within(dialog).getByLabelText('Nouveau loyer hors charges (€) *');
    await userEvent.clear(field);
    await userEvent.type(field, 'abc');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Réviser le loyer' }));
    expect(await within(dialog).findByText('Indiquez le nouveau loyer, ex. 865 ou 865,50.')).toBeTruthy();
    expect((await leasesOf(sources.baux)).find((lease) => lease.id === 'apt-a3')?.rent).toBe(before);
  });

  it('désactive la révision d’un bail terminé', async () => {
    renderLot(<BauxPage />);
    await userEvent.click(await screen.findByRole('tab', { name: /Terminés/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Plus d’actions, bail BL-2020-0003' }));
    expect((await screen.findByRole('menuitem', { name: 'Réviser le loyer' })).getAttribute('aria-disabled')).toBe('true');
  });
});
