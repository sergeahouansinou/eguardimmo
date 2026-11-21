import { describe, expect, it } from 'vitest';
import { attachmentIssue, scheduleIssue } from './inputs';
import { validateEditor } from './editorValidation';
import type { EditorValues } from './editorValidation';
import { MERGE_FIELDS, previewText, unknownMergeFields } from './mergeFields';
import { campaignCapabilities, isCancellable, isEditable, readRate } from './model';
import type { CampaignMetrics } from './model';

describe('champs de fusion', () => {
  it('liste les champs inconnus de l’audience, aux deux syntaxes', () => {
    expect(unknownMergeFields('Bonjour {{ Prénom }}, {Bien}, {{ Solde }} et { Mandat }', 'tenants')).toEqual(['Solde', 'Mandat']);
    expect(unknownMergeFields('Bonjour {{ Mandat }}', 'mandants')).toEqual([]);
    expect(MERGE_FIELDS.mandants).not.toContain('Bien');
  });

  it('remplace par des exemples les champs connus et vide les inconnus', () => {
    expect(previewText('Bonjour {{ Prénom }} pour {Bien} {{ Solde }}.', 'tenants')).toBe('Bonjour Awa pour Apt A1 .');
  });
});

const NO_METRICS: CampaignMetrics = { queued: 0, sending: 0, sent: 0, unknown: 0, bounced: 0, failed: 0, suppressed: 0, skippedNoEmail: 0, read: 0, unsubscribed: 0 };

describe('droits et états', () => {
  it('réserve les campagnes au titulaire, aux administrateurs et aux gestionnaires', () => {
    expect(campaignCapabilities('owner', 'agency')).toEqual({ manage: true, audiences: ['tenants', 'mandants'] });
    expect(campaignCapabilities('manager', 'individual')).toEqual({ manage: true, audiences: ['tenants'] });
    expect(campaignCapabilities('accountant', 'agency')).toEqual({ manage: false, audiences: [] });
  });

  it('ne modifie qu’un brouillon et n’annule qu’une programmation', () => {
    expect(isEditable({ status: 'draft' })).toBe(true);
    expect(isEditable({ status: 'scheduled' })).toBe(false);
    expect(isCancellable({ status: 'scheduled' })).toBe(true);
    expect(isCancellable({ status: 'sending' })).toBe(false);
  });

  it('calcule le taux de lecture sur les envois réussis', () => {
    expect(readRate({ ...NO_METRICS, sent: 8, read: 4 })).toBe(50);
    expect(readRate(NO_METRICS)).toBeNull();
  });
});

describe('validation de l’éditeur', () => {
  const base: EditorValues = { subject: 'Objet', body: 'Message', audience: 'tenants', buildingIds: [], copyToHistory: true, scope: 'all' };

  it('accepte un brouillon sans message mais exige le message à l’envoi', () => {
    expect(validateEditor({ ...base, body: '' }, false)).toEqual({});
    expect(validateEditor({ ...base, body: '  ' }, true).body).toBe('Saisissez le message');
  });

  it('bloque « certains immeubles » sans immeuble choisi, qui enverrait à tous', () => {
    expect(validateEditor({ ...base, scope: 'some' }, false).buildingIds).toBe('Ajoutez au moins un immeuble');
    expect(validateEditor({ ...base, scope: 'some', buildingIds: ['b1'] }, true)).toEqual({});
  });

  it('refuse un champ de fusion inconnu dans l’objet comme dans le message', () => {
    expect(validateEditor({ ...base, subject: 'Solde {{ Solde }}' }, false).subject).toContain('Champ de fusion inconnu : Solde');
    expect(validateEditor({ ...base, body: '{{ Mandat }}' }, true).body).toContain('Champ de fusion inconnu : Mandat');
  });
});

describe('programmation et pièces jointes', () => {
  const now = new Date('2026-11-19T09:00:00+00:00');

  it('exige 15 minutes d’avance', () => {
    expect(scheduleIssue('2026-11-19T09:14:00+00:00', now)).toContain('15 minutes');
    expect(scheduleIssue('2026-11-19T09:15:00+00:00', now)).toBeNull();
    expect(scheduleIssue('pas une date', now)).toContain('Choisissez');
  });

  it('n’accepte que des PDF non vides de 5 Mo au plus, 3 au maximum', () => {
    expect(attachmentIssue({ name: 'a.pdf', size: 10, type: 'application/pdf' }, 0, 3)).toBeNull();
    expect(attachmentIssue({ name: 'a.png', size: 10, type: 'image/png' }, 0, 3)).toContain('PDF');
    expect(attachmentIssue({ name: 'a.pdf', size: 0, type: 'application/pdf' }, 0, 3)).toContain('vide');
    expect(attachmentIssue({ name: 'a.pdf', size: 5 * 1024 * 1024 + 1, type: 'application/pdf' }, 0, 3)).toContain('5 Mo');
    expect(attachmentIssue({ name: 'a.pdf', size: 10, type: 'application/pdf' }, 3, 3)).toContain('3 pièces');
  });
});
