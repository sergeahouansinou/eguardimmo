import { ApiError, ApiUnreachableError, createApiClient } from '@eguardimmo/api';
import { describe, expect, it, vi } from 'vitest';
import { BIENS_FEATURES } from '../capabilities';
import { BiensError, BiensStaleVersionError } from '../errors';
import { createDemoBiensSource } from '../demo/store';
import type { BiensSource } from '../source';
import { translateApiError } from './apiErrors';
import * as api from './responses.fixtures';
import { org, setup } from './support';

const unitUrl = `GET ${org(`/units/${api.IDS.unit}`)}`;

describe('erreurs du serveur', () => {
  it.each([
    [401, 'unauthenticated', 'Votre session a expiré. Reconnectez-vous.'],
    [403, 'forbidden', 'Vous n’avez pas le droit d’effectuer cette action sur les biens.'],
    [404, 'not_found', 'Ce lot n’existe pas dans votre organisation.'],
  ])('traduit un %i en erreur typée', async (status, kind, message) => {
    const body = api.problem(status, status === 404 ? 'unit_not_found' : 'unauthenticated', 'Titre', 'Ce lot n’existe pas dans votre organisation.');
    const { source } = setup({ [`GET ${org('/units')}`]: { status, body } });
    const error = await source.lotPage().catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(BiensError);
    expect(error).toMatchObject({ kind, status, message });
  });

  it('distingue un conflit métier d’un conflit de version', () => {
    const conflict = translateApiError(new ApiError(409, 'unit_reference_taken', 'Référence déjà utilisée.'));
    const stale = translateApiError(new ApiError(409, 'unit_version_conflict', 'Lot modifié.'));
    expect(conflict).toMatchObject({ kind: 'conflict', code: 'unit_reference_taken' });
    expect(stale).toBeInstanceOf(BiensStaleVersionError);
    expect(stale).toMatchObject({ kind: 'stale_version', message: expect.stringContaining('modifié entre-temps') as string });
  });

  it('traduit un 422 avec le premier message de champ', () => {
    const error = translateApiError(new ApiError(422, 'validation_failed', 'Invalide', { 'address.country': ['Pays invalide.'] }));
    expect(error).toMatchObject({ kind: 'invalid', message: 'Pays invalide.', fieldErrors: { 'address.country': ['Pays invalide.'] } });
  });

  it('traduit un serveur injoignable', () => {
    expect(translateApiError(new ApiUnreachableError())).toMatchObject({ kind: 'unreachable' });
  });

  it('rend une panne réseau lisible sans la prendre pour « introuvable »', async () => {
    const client = createApiClient({ baseUrl: 'https://api.test', fetchImpl: vi.fn<typeof fetch>(() => Promise.reject(new TypeError('network'))), readCookie: () => 'x' });
    const { createApiBiensSource } = await import('./apiSource');
    const source = createApiBiensSource({ client, organizationId: api.IDS.org });
    await expect(source.lot(api.IDS.unit)).rejects.toMatchObject({ kind: 'unreachable' });
  });

  it('refuse de charger sans organisation sélectionnée', async () => {
    const { source, calls } = setup({}, null);
    await expect(source.lots()).rejects.toMatchObject({ kind: 'no_organization' });
    expect(calls).toHaveLength(0);
  });

  it('laisse passer le 404 d’une fiche comme « introuvable » et pas les autres erreurs', async () => {
    const forbidden = setup({ [unitUrl]: { status: 403, body: api.problem(403, 'space_forbidden', 'Interdit', 'Interdit.') } });
    await expect(forbidden.source.lot(api.IDS.unit)).rejects.toMatchObject({ kind: 'forbidden' });
  });
});

describe('fonctions sans route serveur', () => {
  const args: Record<string, unknown[]> = {
    lotDiagnostics: ['x'], lotSuivi: ['x'], lotFinances: ['x'], immeubleCharges: ['x'], immeubleCopro: ['x'], immeubleInterventions: ['x'],
    equipements: [], equipement: ['x'], equipementInterventions: ['x'], readings: [], inventaires: [], documents: [{ kind: 'lot', id: 'x' }],
    duplicateLot: ['x'], setLotListing: ['x', 'en_ligne'], importLots: [[]], addDiagnostic: ['x', {}], orderDiagnostics: ['x', []],
    deleteLot: ['x'], deleteImmeuble: ['x'], createEquipement: [{}], updateEquipement: ['x', {}], setEquipementArchived: ['x', true],
    deleteEquipement: ['x'], addLogEntry: ['x', {}], addOperation: ['x', {}], addDocument: [{ kind: 'lot', id: 'x' }, {}],
    setDocumentShared: ['x', true], deleteDocument: ['x'], createReading: [{}], updateReading: ['x', {}], attachReadingPhoto: ['x'],
    setReadingArchived: ['x', true], deleteReading: ['x'], createInventaire: [{}], updateInventaire: ['x', {}], requestInventaireSignature: ['x'],
    duplicateInventaire: ['x'], setInventaireArchived: ['x', true], deleteInventaire: ['x'],
  };

  it('rejettent explicitement, sans appel réseau ni donnée de démonstration', async () => {
    const { source, calls } = setup({});
    for (const [name, params] of Object.entries(args)) {
      const method = (source as unknown as Record<string, (...input: unknown[]) => Promise<unknown>>)[name];
      await expect(method?.(...params), name).rejects.toMatchObject({ kind: 'unsupported' });
    }
    expect(calls).toHaveLength(0);
  });

  it('couvrent exactement les méthodes de l’interface qui ne sont pas reliées', () => {
    const { source } = setup({});
    const demo = createDemoBiensSource({ latencyMs: 0 });
    const reliees = ['lots', 'lot', 'lotOccupation', 'lotLease', 'immeubles', 'immeuble', 'createLot', 'updateLot', 'setLotsArchived', 'createImmeuble', 'updateImmeuble', 'setImmeubleArchived', 'unavailableInApiMode'];
    const methodes = Object.keys(demo).filter((name) => !reliees.includes(name)).sort();
    expect(Object.keys(args).sort()).toEqual(methodes);
    expect(source.unavailableInApiMode).toEqual(BIENS_FEATURES);
    const complet: BiensSource = source;
    expect(Object.keys(complet).length).toBeGreaterThan(methodes.length);
  });
});
