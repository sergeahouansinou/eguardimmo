import { ApiError, ApiUnreachableError } from '@eguardimmo/api';
import { describe, expect, it } from 'vitest';
import { UnexpectedResponseError, describeThreadFailure, isFinalFailure, sendFailureMessage } from './errors';

const api = (status: number, code: string, fields: Record<string, string[]> = {}, retry: number | null = null) =>
  new ApiError(status, code, 'Message serveur brut', fields, retry);

describe('erreurs de la messagerie externe', () => {
  it.each([
    [api(401, 'unauthenticated'), 'unauthenticated', 'Votre session a expiré'],
    [api(403, 'conversation_muted'), 'readOnly', 'a restreint l’envoi'],
    [api(403, 'conversation_read_only'), 'readOnly', 'Votre mandat est terminé'],
    [api(403, 'owner_role_forbidden'), 'readOnly', 'titulaire ou son représentant'],
    [api(403, 'two_factor_required'), 'forbidden', 'double authentification'],
    [api(403, 'reauthentication_required'), 'forbidden', 'moins de 10 minutes'],
    [api(403, 'inconnu'), 'forbidden', 'pas le droit'],
    [api(404, 'conversation_not_found'), 'notFound', 'n’existe pas ou n’est plus accessible'],
    [api(404, 'conversation_link_not_found'), 'notFound', 'Ce bail ou ce mandat'],
    [api(404, 'owner_agency_not_found'), 'notFound', 'Cette agence'],
    [api(409, 'conversation_closed'), 'closed', 'a fermé cette conversation'],
    [api(409, 'conversation_open_limit'), 'conflict', 'beaucoup de conversations ouvertes'],
    [api(409, 'conversation_storage_full'), 'conflict', 'plus recevoir de pièces jointes'],
    [api(409, 'message_redaction_expired'), 'conflict', '15 minutes'],
    [api(409, 'idempotency_key_reused'), 'conflict', 'contenu différent'],
    [api(422, 'recipient_not_found'), 'invalid', 'ne fait pas partie de vos contacts'],
    [api(422, 'validation_failed', { body: ['x'] }), 'invalid', '5 000 caractères'],
    [api(422, 'validation_failed', { subject: ['x'] }), 'invalid', 'objet est obligatoire'],
    [api(422, 'validation_failed', { 'attachments.0': ['x'] }), 'invalid', '10 Mo'],
    [api(422, 'validation_failed', { autre: ['x'] }), 'invalid', 'Certains champs'],
    [api(429, 'conversation_attachment_limit'), 'rateLimited', 'réessayez demain'],
    [api(429, 'throttle', {}, 30), 'rateLimited', 'Patientez 30 s'],
    [api(429, 'throttle', {}, 300), 'rateLimited', 'Patientez 5 min'],
    [api(503, 'unavailable'), 'unavailable', 'momentanément indisponible'],
    [new ApiUnreachableError(), 'unreachable', 'injoignable'],
    [new UnexpectedResponseError(), 'unexpected', 'inattendue'],
    [new Error('boom'), 'other', 'Une erreur est survenue'],
  ])('traduit %# en français sans reprendre le texte du serveur', (error, kind, fragment) => {
    const failure = describeThreadFailure(error);
    expect(failure.kind).toBe(kind);
    expect(failure.message).toContain(fragment);
    expect(failure.message).not.toContain('Message serveur brut');
  });

  it('rassure sur le renvoi quand l’issue d’un envoi est inconnue', () => {
    expect(sendFailureMessage(new ApiUnreachableError())).toContain('enregistré qu’une seule fois');
    expect(sendFailureMessage(api(409, 'conversation_closed'))).not.toContain('une seule fois');
  });

  it('ne rejoue plus une interrogation dont l’accès est perdu', () => {
    expect(isFinalFailure(api(401, 'x'))).toBe(true);
    expect(isFinalFailure(api(403, 'x'))).toBe(true);
    expect(isFinalFailure(api(404, 'x'))).toBe(true);
    expect(isFinalFailure(api(429, 'x'))).toBe(false);
    expect(isFinalFailure(api(500, 'x'))).toBe(false);
    expect(isFinalFailure(new ApiUnreachableError())).toBe(false);
  });
});
