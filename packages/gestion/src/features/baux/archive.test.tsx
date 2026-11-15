import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FROZEN_NOW, norm, renderLot } from '../../../test/lots';
import { BauxPage } from './BauxPage';
import { demoLeases } from './demo';
import { isRunningLease } from './leaseRules';
import type { Lease } from './schemas';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN_NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

const leasesOf = async (source: { leases: () => Promise<unknown> }) => (await source.leases()) as Lease[];
const dataRows = (table: HTMLElement) => within(table).getAllByRole('row').slice(1);

describe('Archivage des baux : source', () => {
  it('archive un bail terminé sans toucher à son statut ni le supprimer', async () => {
    const { sources } = renderLot(<BauxPage />);
    const before = (await leasesOf(sources.baux)).length;
    const archived = (await sources.baux.setLeaseArchived('apt-a1-2020', true)) as Lease;
    expect(archived).toMatchObject({ id: 'apt-a1-2020', archived: true, status: 'termine', rent: 64000 });
    const all = await leasesOf(sources.baux);
    expect(all).toHaveLength(before);
    expect(all.filter(isRunningLease)).toHaveLength(demoLeases.filter(isRunningLease).length);
  });

  it('archive un brouillon puis le désarchive', async () => {
    const { sources } = renderLot(<BauxPage />);
    expect(await sources.baux.setLeaseArchived('apt-a3-2', true)).toMatchObject({ archived: true, status: 'brouillon' });
    expect(await sources.baux.setLeaseArchived('apt-a3-2', false)).toMatchObject({ archived: false, status: 'brouillon' });
  });

  it.each(['apt-a1', 'studio-2e', 'apt-b3'])('refuse d’archiver le bail %s (en cours, préavis ou à venir)', async (id) => {
    const { sources } = renderLot(<BauxPage />);
    await expect(sources.baux.setLeaseArchived(id, true)).rejects.toThrow('Seul un bail terminé ou un brouillon peut être archivé');
    expect((await leasesOf(sources.baux)).find((lease) => lease.id === id)?.archived).toBe(false);
  });

  it('refuse un double archivage, un désarchivage inutile et la suppression d’un brouillon archivé', async () => {
    const { sources } = renderLot(<BauxPage />);
    await expect(sources.baux.setLeaseArchived('apt-a1-2020', false)).rejects.toThrow('Ce bail n’est pas archivé.');
    await sources.baux.setLeaseArchived('apt-a3-2', true);
    await expect(sources.baux.setLeaseArchived('apt-a3-2', true)).rejects.toThrow('Ce bail est déjà archivé.');
    await expect(sources.baux.deleteLease('apt-a3-2')).rejects.toThrow('désarchivez-le d’abord');
    expect(() => sources.baux.setLeaseArchived('inconnu', true)).toThrow('Bail introuvable');
  });
});

describe('Archivage des baux : liste', () => {
  it('archive un bail terminé après confirmation et l’expose dans l’onglet Archivés', async () => {
    const { sources } = renderLot(<BauxPage />);
    await screen.findByRole('table', { name: 'Baux' });
    expect(screen.getByRole('tab', { name: /Archivés/ }).textContent).toContain('0');
    await userEvent.click(screen.getByRole('tab', { name: /Terminés/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Plus d’actions, bail BL-2020-0003' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Archiver' }));
    const dialog = await screen.findByRole('dialog');
    expect(norm(dialog.textContent)).toContain('Rien n’est supprimé');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Archiver' }));
    await waitFor(async () => { expect((await leasesOf(sources.baux)).find((lease) => lease.id === 'apt-a1-2020')?.archived).toBe(true); });
    await waitFor(() => { expect(screen.getByRole('tab', { name: /Terminés/ }).textContent).toContain('1'); });
    expect(screen.getByRole('tab', { name: /Archivés/ }).textContent).toContain('1');
    expect(screen.getByRole('tab', { name: /Actifs/ }).textContent).toContain('9');
    expect(norm(document.body.textContent)).toContain('9 baux en cours');

    await userEvent.click(screen.getByRole('tab', { name: /Archivés/ }));
    const rows = dataRows(await screen.findByRole('table', { name: 'Baux' }));
    expect(rows).toHaveLength(1);
    expect(norm(rows[0]?.textContent)).toContain('BL-2020-0003');
  });

  it('désarchive un bail depuis l’onglet Archivés', async () => {
    const { sources } = renderLot(<BauxPage />);
    await screen.findByRole('table', { name: 'Baux' });
    await userEvent.click(screen.getByRole('tab', { name: /Terminés/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Plus d’actions, bail BL-2020-0003' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Archiver' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Archiver' }));
    await userEvent.click(await screen.findByRole('tab', { name: /Archivés/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Plus d’actions, bail BL-2020-0003' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Désarchiver' }));
    await waitFor(async () => { expect((await leasesOf(sources.baux)).find((lease) => lease.id === 'apt-a1-2020')?.archived).toBe(false); });
    await waitFor(() => { expect(screen.getByRole('tab', { name: /Archivés/ }).textContent).toContain('0'); });
    await userEvent.click(screen.getByRole('tab', { name: /Terminés/ }));
    expect(dataRows(await screen.findByRole('table', { name: 'Baux' }))).toHaveLength(2);
  });

  it('explique dans le menu qu’un bail en cours ne s’archive pas', async () => {
    const { sources } = renderLot(<BauxPage />);
    await screen.findByRole('table', { name: 'Baux' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, bail BL-2023-0007' }));
    const item = await screen.findByRole('menuitem', { name: 'Archiver (bail terminé ou brouillon uniquement)' });
    expect(item.getAttribute('aria-disabled')).toBe('true');
    expect((await leasesOf(sources.baux)).find((lease) => lease.id === 'apt-a1')?.archived).toBe(false);
  });
});
