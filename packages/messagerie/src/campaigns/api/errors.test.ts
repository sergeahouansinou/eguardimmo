import { ApiError, ApiUnreachableError } from '@eguardimmo/api';
import { describe, expect, it } from 'vitest';
import { UnexpectedResponseError } from '../../external/api/errors';
import { campaignErrorMessage, describeCampaignFailure, isVersionConflict } from './errors';

const api = (status: number, code: string, fields: Record<string, string[]> = {}, retry: number | null = null) => new ApiError(status, code, 'Détail serveur à ne pas afficher', fields, retry);

describe('traduction des erreurs de campagne', () => {
  it.each([
    [api(403, 'two_factor_required'), 'twoFactorRequired', 'Activez la double authentification'],
    [api(403, 'reauthentication_required'), 'reauthRequired', 'code de double authentification de moins de 10 minutes'],
    [api(403, 'role_forbidden'), 'forbidden', 'réservées au titulaire'],
    [api(409, 'campaign_version_conflict'), 'versionConflict', 'modifiée entre-temps'],
    [api(409, 'campaign_not_editable'), 'notEditable', 'Seul un brouillon se modifie'],
    [api(409, 'campaign_attachment_not_ready'), 'conflict', 'vérification antivirus'],
    [api(409, 'campaign_attachment_limit'), 'conflict', 'trois pièces jointes'],
    [api(404, 'campaign_not_found'), 'notFound', 'n’existe pas'],
    [api(404, 'announcement_not_found'), 'notFound', 'ne vous concerne pas'],
    [api(422, 'campaign_audience_empty'), 'invalid', 'Aucun destinataire'],
    [api(422, 'campaign_schedule_invalid'), 'invalid', '15 minutes'],
    [api(503, 'campaign_sending_disabled'), 'sendingDisabled', 'pas encore activé'],
    [api(503, 'http_503'), 'unavailable', 'momentanément indisponible'],
    [api(401, 'http_401'), 'unauthenticated', 'session a expiré'],
    [api(500, 'http_500'), 'other', 'Une erreur est survenue'],
  ] as const)('%#: code %s', (error, kind, text) => {
    const failure = describeCampaignFailure(error);
    expect(failure.kind).toBe(kind);
    expect(failure.message).toContain(text);
    expect(failure.message).not.toContain('Détail serveur');
  });

  it('indique le délai d’attente d’un 429 en secondes ou en minutes', () => {
    expect(campaignErrorMessage(api(429, 'http_429', {}, 30))).toBe('Trop de demandes en peu de temps. Patientez 30 s avant de réessayer.');
    expect(campaignErrorMessage(api(429, 'http_429', {}, 600))).toContain('10 min');
    expect(campaignErrorMessage(api(429, 'http_429'))).toContain('un instant');
    expect(describeCampaignFailure(api(429, 'campaign_quota_reached', {}, 120)).message).toContain('2 min');
  });

  it('retient le champ de fusion inconnu renvoyé par le serveur, puis les autres champs', () => {
    expect(campaignErrorMessage(api(422, 'validation_failed', { body: ['Champ de fusion inconnu : Solde.'] }))).toBe('Champ de fusion inconnu : Solde.');
    expect(campaignErrorMessage(api(422, 'validation_failed', { subject: ['requis'] }))).toContain('L’objet est obligatoire');
    expect(campaignErrorMessage(api(422, 'validation_failed', { 'building_ids.0': ['inconnu'] }))).toContain('Un immeuble choisi');
    expect(campaignErrorMessage(api(422, 'validation_failed', { file: ['mimes'] }))).toContain('PDF uniquement');
    expect(campaignErrorMessage(api(422, 'validation_failed', { autre: ['x'] }))).toContain('Certains champs sont invalides');
  });

  it('distingue réseau, réponse hors contrat et erreur inconnue', () => {
    expect(describeCampaignFailure(new ApiUnreachableError()).kind).toBe('unreachable');
    expect(describeCampaignFailure(new UnexpectedResponseError()).kind).toBe('unexpected');
    expect(describeCampaignFailure(new Error('boom')).message).toBe('Une erreur est survenue. Réessayez dans un instant.');
  });

  it('reconnaît un conflit de version', () => {
    expect(isVersionConflict(api(409, 'campaign_version_conflict'))).toBe(true);
    expect(isVersionConflict(api(409, 'campaign_not_editable'))).toBe(false);
  });
});
