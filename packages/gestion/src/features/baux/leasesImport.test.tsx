import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FROZEN_NOW, norm, renderLot } from '../../../test/lots';
import { BauxPage } from './BauxPage';
import { demoLeases } from './demo';
import { parseLeasesCsv } from './leasesImport';
import type { Lease } from './schemas';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN_NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

const units = [
  { id: 'apt-a1', label: 'Apt A1', building: 'Les Tilleuls' },
  { id: 'studio-plage', label: 'Studio Plage', building: 'Résidence de la Plage' },
  { id: 'gite-du-lac', label: 'Gîte du Lac', building: 'Domaine du Lac' },
];
const tenants = [
  { id: 'koffi-adjovi', name: 'Koffi Adjovi' },
  { id: 'mariam-sy', name: 'Mariam Sy' },
  { id: 'paul-houngbo', name: 'Paul Houngbo' },
];
const header = 'Bien;Locataire;Début;Fin;Loyer;Charges;Dépôt;Type';
const parse = (lines: string[], existing: readonly Lease[] = demoLeases) => parseLeasesCsv([header, ...lines].join('\n'), units, tenants, existing, '2026-11-13');
const leasesOf = async (source: { leases: () => Promise<unknown> }) => (await source.leases()) as Lease[];

describe('Import CSV des baux : lecture du fichier', () => {
  it('accepte une ligne valide, convertit les dates et le type', () => {
    const report = parse(['Studio Plage;Mariam Sy;01/12/2026;30/11/2027;500,50;50;500;Meublé']);
    expect(report.rejected).toEqual([]);
    expect(report.accepted).toEqual([
      { line: 2, input: { unitId: 'studio-plage', tenantId: 'mariam-sy', start: '2026-12-01', end: '2027-11-30', rent: '500,50', charges: '50', deposit: '500', furnished: true } },
    ]);
  });

  it('prend « vide » par défaut quand la colonne Type est absente', () => {
    const report = parse(['Gîte du Lac;Paul Houngbo;2027-01-01;2027-12-31;400;0;400']);
    expect(report.accepted[0]?.input.furnished).toBe(false);
  });

  it('rapporte chaque ligne invalide avec son motif et garde les lignes valides', () => {
    const report = parse([
      'Gîte du Lac;Paul Houngbo;01/01/2027;31/12/2027;400;0;400;Vide',
      'Villa inconnue;Paul Houngbo;01/01/2027;31/12/2027;400;0;400;Vide',
      'Gîte du Lac;Inconnu;01/01/2027;31/12/2027;400;0;400;Vide',
      'Gîte du Lac;Paul Houngbo;01/01/2027;31/12/2027;400;0;400;Cabane',
      'Gîte du Lac;Paul Houngbo;01/01/2027;31/12/2027;abc;0;400;Vide',
      'Gîte du Lac;Paul Houngbo;31/12/2027;01/01/2027;400;0;400;Vide',
      'Gîte du Lac;Paul Houngbo;01/01/2027;31/12/2027;400;0;900;Vide',
      'Gîte du Lac;Paul Houngbo;01/01/2027',
    ]);
    expect(report.accepted.map((entry) => entry.line)).toEqual([2]);
    expect(report.rejected.map((entry) => [entry.line, entry.reason])).toEqual([
      [3, 'Bien inconnu : « Villa inconnue ».'],
      [4, 'Locataire inconnu : « Inconnu ».'],
      [5, 'Type inconnu : « Cabane », attendu vide ou meublé.'],
      [6, 'Indiquez le loyer, ex. 850 ou 850,50'],
      [7, 'La fin doit suivre le début du bail'],
      [8, 'Le dépôt ne peut pas dépasser 1 mois de loyer hors charges'],
      [9, '3 colonnes trouvées, 7 ou 8 attendues.'],
    ]);
  });

  it('refuse un bail qui chevauche un bail existant sur la même unité', () => {
    const report = parse(['Apt A1;Koffi Adjovi;01/01/2027;31/12/2027;770;80;770;Vide']);
    expect(report.accepted).toEqual([]);
    expect(report.rejected).toEqual([{ line: 2, reason: 'Apt A1 est déjà loué du 01/04/2023 au 31/03/2029 (le bail BL-2023-0007).' }]);
  });

  it('refuse un chevauchement entre deux lignes du même fichier', () => {
    const report = parse([
      'Gîte du Lac;Paul Houngbo;01/01/2024;31/12/2024;400;0;400;Vide',
      'Gîte du Lac;Mariam Sy;01/06/2024;31/05/2025;400;0;400;Vide',
    ]);
    expect(report.accepted.map((entry) => entry.line)).toEqual([2]);
    expect(report.rejected[0]).toEqual({ line: 3, reason: 'Gîte du Lac est déjà loué du 01/01/2024 au 31/12/2024 (une ligne précédente du fichier).' });
  });

  it('rejette un fichier vide, un en-tête invalide et un fichier trop long', () => {
    expect(parseLeasesCsv('', units, tenants, [], '2026-11-13').rejected[0]?.reason).toBe('Le fichier est vide.');
    expect(parseLeasesCsv('Nom;Prénom\nA;B', units, tenants, [], '2026-11-13').rejected[0]?.reason).toContain('En-tête invalide');
    const rows = Array.from({ length: 201 }, () => 'Gîte du Lac;Paul Houngbo;01/01/2027;31/12/2027;400;0;400;Vide');
    expect(parse(rows).rejected[0]?.reason).toBe('Le fichier dépasse 200 baux.');
  });
});

describe('Import des baux : source', () => {
  const row = { unitId: 'studio-plage', tenantId: 'mariam-sy', start: '2026-12-01', end: '2027-11-30', rent: '500', charges: '50', deposit: '500', furnished: false };

  it('crée les baux avec montants en centimes, statut calculé et référence suivante', async () => {
    const { sources } = renderLot(<BauxPage />);
    const created = (await sources.baux.importLeases([row, { ...row, unitId: 'gite-du-lac', tenantId: 'paul-houngbo', start: '2024-01-01', end: '2024-12-31', rent: '400,50', deposit: '400' }])) as Lease[];
    expect(created).toHaveLength(2);
    expect(created[0]).toMatchObject({ unitId: 'studio-plage', status: 'a_venir', rent: 50000, charges: 5000, deposit: 50000, durationMonths: 12, archived: false, reference: 'BL-2026-0019' });
    expect(created[1]).toMatchObject({ status: 'termine', rent: 40050, nextRevision: null, reference: 'BL-2026-0020' });
    expect((await leasesOf(sources.baux)).filter((lease) => lease.unitId === 'studio-plage')).toHaveLength(1);
  });

  it('refuse tout l’import si une ligne chevauche un bail existant', async () => {
    const { sources } = renderLot(<BauxPage />);
    const before = (await leasesOf(sources.baux)).length;
    await expect(sources.baux.importLeases([row, { ...row, unitId: 'apt-a1', tenantId: 'koffi-adjovi', start: '2027-01-01', end: '2027-12-31' }])).rejects.toThrow(
      'Ligne 2 : ce bien est déjà loué sur cette période (bail BL-2023-0007).',
    );
    expect(await leasesOf(sources.baux)).toHaveLength(before);
  });

  it('revalide côté source : dépôt excessif, montant invalide, fichier vide', async () => {
    const { sources } = renderLot(<BauxPage />);
    await expect(sources.baux.importLeases([{ ...row, deposit: '900' }])).rejects.toThrow('Ligne 1 : Le dépôt ne peut pas dépasser 1 mois de loyer hors charges');
    await expect(sources.baux.importLeases([{ ...row, rent: '12,345' }])).rejects.toThrow('Ligne 1 : Indiquez le loyer, ex. 850 ou 850,50');
    await expect(sources.baux.importLeases([])).rejects.toThrow('Aucun bail à importer.');
  });
});

describe('Import des baux : dialogue', () => {
  const csv = [header, 'Studio Plage;Mariam Sy;01/12/2026;30/11/2027;500;50;500;Vide', 'Apt A1;Koffi Adjovi;01/01/2027;31/12/2027;770;80;770;Vide', 'Villa inconnue;Mariam Sy;01/12/2026;30/11/2027;500;50;500;Vide'].join('\n');

  const openDialog = async () => {
    const rendered = renderLot(<BauxPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Importer' }));
    return { ...rendered, dialog: await screen.findByRole('dialog') };
  };

  it('importe les lignes valides, rapporte les rejets et rattache le locataire au bien', async () => {
    const { sources, dialog } = await openDialog();
    await userEvent.upload(within(dialog).getByLabelText('Fichier CSV des baux'), new File([csv], 'baux.csv', { type: 'text/csv' }), { applyAccept: false });
    expect(await within(dialog).findByText('1 ligne valide, 2 rejetées')).toBeTruthy();
    expect(norm(within(dialog).getByRole('table', { name: 'Lignes valides' }).textContent)).toContain('Studio Plage');
    const rejected = norm(within(dialog).getByRole('table', { name: 'Lignes rejetées' }).textContent);
    expect(rejected).toContain('Apt A1 est déjà loué du 01/04/2023 au 31/03/2029 (le bail BL-2023-0007).');
    expect(rejected).toContain('Bien inconnu : « Villa inconnue ».');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Importer 1 bail' }));
    await waitFor(async () => { expect((await leasesOf(sources.baux)).some((lease) => lease.unitId === 'studio-plage')).toBe(true); });
    const tenantsNow = (await sources.tenants.tenants()) as { id: string; unitId: string | null }[];
    expect(tenantsNow.find((tenant) => tenant.id === 'mariam-sy')?.unitId).toBe('studio-plage');
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
    expect(await screen.findByRole('tab', { name: /À venir/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /À venir/ }).textContent).toContain('2');
  });

  it('refuse un fichier qui n’est pas un CSV et désactive l’import tant que rien n’est valide', async () => {
    const { dialog } = await openDialog();
    expect(within(dialog).getByRole('button', { name: 'Importer' }).hasAttribute('disabled')).toBe(true);
    await userEvent.upload(within(dialog).getByLabelText('Fichier CSV des baux'), new File(['x'], 'photo.png', { type: 'image/png' }), { applyAccept: false });
    expect(await within(dialog).findByText('Choisissez un fichier .csv.')).toBeTruthy();
  });

  it('propose le modèle CSV à télécharger', async () => {
    const created = vi.fn<(blob: Blob) => string>(() => 'blob:modele');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn<(url: string) => void>() }));
    const { dialog } = await openDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Télécharger le modèle' }));
    expect(created).toHaveBeenCalledTimes(1);
    const blob = created.mock.calls[0]?.[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(await blob?.text()).toContain('Bien;Locataire;Début;Fin;Loyer;Charges;Dépôt;Type');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
