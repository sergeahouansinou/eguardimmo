import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { renderScreen, screenProps } from '../shared/testing';
import * as download from '../shared/download';
import { ExportPage } from './ExportPage';
import { exportRequestInputSchema } from './schemas';
import { createDemoExportSource, ExportSourceProvider, resetExportDemo } from './source';
import type { ExportSource } from './source';

beforeEach(() => {
  resetExportDemo();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ExportPage', () => {
  it('liste les demandes passées, avec leur statut, sans axe', async () => {
    const { container } = renderScreen(<ExportPage {...screenProps} />);
    const table = await screen.findByRole('table', { name: 'Demandes d’export de données' });
    expect(within(table).getByText('Prête')).toBeTruthy();
    expect(within(table).getByText('Expirée')).toBeTruthy();
    expect(within(table).getAllByRole('button', { name: /Télécharger/ })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Exporter mes données' })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('enregistre une demande, la montre en préparation puis prête après actualisation', async () => {
    renderScreen(<ExportPage {...screenProps} />);
    await screen.findByRole('table', { name: 'Demandes d’export de données' });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Finances' }));
    await userEvent.click(screen.getByRole('radio', { name: 'JSON (structuré)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Demander l’export' }));

    expect(await screen.findByText('En préparation')).toBeTruthy();
    expect(screen.getByText('Demande d’export enregistrée. L’archive est en préparation.')).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Demandes d’export de données' });
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(within(table).getByText('Biens et immeubles, Locataires et candidats, Baux et états des lieux, Finances · JSON (structuré) · Tout l’historique')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    await waitFor(() => { expect(screen.queryByText('En préparation')).toBeNull(); });
    expect(within(table).getAllByRole('button', { name: /Télécharger/ })).toHaveLength(2);
  });

  it('télécharge l’archive simulée d’une demande prête', async () => {
    const spy = vi.spyOn(download, 'downloadFile').mockImplementation(() => undefined);
    renderScreen(<ExportPage {...screenProps} />);
    await userEvent.click(await screen.findByRole('button', { name: /Télécharger/ }));
    await waitFor(() => { expect(spy).toHaveBeenCalledTimes(1); });
    const [filename, content, type] = spy.mock.calls[0] ?? [];
    expect(filename).toBe('eguardimmo-export-exp-2026-11-02.csv');
    expect(type).toContain('text/csv');
    expect(content).toContain('biens;all;csv');
    expect(content).toContain('baux;all;csv');
  });

  it('refuse une demande sans donnée sélectionnée', async () => {
    renderScreen(<ExportPage {...screenProps} />);
    await screen.findByRole('table', { name: 'Demandes d’export de données' });
    for (const name of ['Biens et immeubles', 'Locataires et candidats', 'Baux et états des lieux']) {
      await userEvent.click(screen.getByRole('checkbox', { name }));
    }
    await userEvent.click(screen.getByRole('button', { name: 'Demander l’export' }));
    expect(await screen.findByText('Choisissez au moins un type de données')).toBeTruthy();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3);
  });

  it('signale l’échec de la demande et du chargement', async () => {
    const failing: ExportSource = {
      ...createDemoExportSource(),
      requestExport: () => Promise.reject(new Error('indisponible')),
    };
    renderScreen(
      <ExportSourceProvider source={failing}>
        <ExportPage {...screenProps} />
      </ExportSourceProvider>,
    );
    await screen.findByRole('table', { name: 'Demandes d’export de données' });
    await userEvent.click(screen.getByRole('button', { name: 'Demander l’export' }));
    expect(await screen.findByText('La demande n’a pas pu être enregistrée')).toBeTruthy();
  });

  it('affiche l’erreur de chargement avec un bouton Réessayer', async () => {
    const broken: ExportSource = { ...createDemoExportSource(), listRequests: () => Promise.reject(new Error('panne')) };
    renderScreen(
      <ExportSourceProvider source={broken}>
        <ExportPage {...screenProps} />
      </ExportSourceProvider>,
    );
    expect(await screen.findByText('Impossible de charger les demandes d’export')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('affiche l’état vide', async () => {
    const empty: ExportSource = { ...createDemoExportSource(), listRequests: () => Promise.resolve([]) };
    renderScreen(
      <ExportSourceProvider source={empty}>
        <ExportPage {...screenProps} />
      </ExportSourceProvider>,
    );
    expect(await screen.findByText('Aucune demande d’export')).toBeTruthy();
  });
});

describe('exportRequestInputSchema', () => {
  it('exige au moins une rubrique et un format connu', () => {
    expect(exportRequestInputSchema.safeParse({ scopes: [], format: 'csv', period: 'all' }).success).toBe(false);
    expect(exportRequestInputSchema.safeParse({ scopes: ['biens'], format: 'xml', period: 'all' }).success).toBe(false);
    expect(exportRequestInputSchema.safeParse({ scopes: ['biens'], format: 'json', period: 'year2026' }).success).toBe(true);
  });
});
