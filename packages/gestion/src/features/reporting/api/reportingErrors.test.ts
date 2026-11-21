import { ApiError } from '@eguardimmo/api';
import { describe, expect, it } from 'vitest';
import { CODE_MESSAGES, ReportingApiError, failureMessage, translateApiError, waitLabel } from './reportingErrors';

const CODES = [
  'report_not_found',
  'report_mandant_not_found',
  'report_stale_version',
  'report_period_overlap',
  'report_period_invalid',
  'report_period_not_closed',
  'report_not_editable',
  'report_not_publishable',
  'report_idempotency_key_required',
  'report_idempotency_key_reused',
  'report_issuer_incomplete',
  'report_pdf_unavailable',
  'report_not_generated',
  'statement_too_long',
  'export_too_large',
  'reporting_agency_only',
  'reporting_jurisdiction_unsupported',
  'two_factor_required',
];

describe('messages français des codes du module Reporting', () => {
  it.each(CODES)('%s a un message en français', (code) => {
    expect(CODE_MESSAGES[code]).toMatch(/[a-zé]{4,}/);
  });

  it('chaque code est traduit quel que soit le statut renvoyé', () => {
    for (const [code, status] of [['report_not_found', 404], ['report_period_overlap', 409], ['report_issuer_incomplete', 422], ['report_pdf_unavailable', 503], ['reporting_agency_only', 403]] as const) {
      const error = translateApiError(new ApiError(status, code, 'détail brut'));
      expect(error).toBeInstanceOf(ReportingApiError);
      const message = (error as ReportingApiError).message;
      if (status === 503) expect(message).toContain('Réessayez');
      else expect(message).toBe(CODE_MESSAGES[code]);
      expect(message).not.toContain('détail brut');
    }
  });

  it('une erreur inconnue garde le message du serveur', () => {
    const error = translateApiError(new ApiError(409, 'autre_code', 'Message serveur')) as ReportingApiError;
    expect(error.message).toBe('Message serveur');
    expect(error.kind).toBe('conflict');
  });

  it('les erreurs qui ne viennent pas de l’API traversent', () => {
    const raw = new TypeError('x');
    expect(translateApiError(raw)).toBe(raw);
  });

  it('la clé de lecture d’un champ invalide est traduite', () => {
    const error = translateApiError(new ApiError(422, 'validation', 'The given data was invalid.', { reason: ['The reason must be at least 10.'] })) as ReportingApiError;
    expect(error.message).toBe('Le motif doit contenir entre 10 et 500 caractères.');
  });

  it('le message d’un échec par mandant reprend le français du code ou, à défaut, le détail du serveur', () => {
    expect(failureMessage({ code: 'report_period_overlap', detail: 'x' })).toBe('Un compte rendu en cours ou publié couvre déjà tout ou partie de cette période pour ce mandant.');
    expect(failureMessage({ code: 'inconnu', detail: 'Détail serveur' })).toBe('Détail serveur');
  });

  it.each([[null, 'un peu plus tard'], [1, 'dans 1 seconde'], [45, 'dans 45 secondes'], [200, 'dans 4 minutes']])('délai %s', (seconds, text) => {
    expect(waitLabel(seconds)).toBe(text);
  });
});
