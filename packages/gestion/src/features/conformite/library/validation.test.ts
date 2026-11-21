import { describe, expect, it } from 'vitest';
import { libraryFailure } from './formErrors';
import { EMPTY_LIBRARY_FORM, subjectOf, toNewDocument, validateLibraryForm } from './validation';
import type { LibraryFormValues } from './validation';
import { ConformiteApiError } from '../api/conformiteErrors';

const ORG = 'org-1';
const TODAY = '2026-11-20';
const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
const valid = (patch: Partial<LibraryFormValues> = {}): LibraryFormValues => ({ ...EMPTY_LIBRARY_FORM, kind: 'other', file, ...patch });

describe('validation du dépôt dans la bibliothèque', () => {
  it('accepte un dépôt minimal sans objet', () => {
    expect(validateLibraryForm(valid(), ORG, TODAY)).toEqual({});
    expect(toNewDocument(valid(), ORG)).toMatchObject({ kind: 'other', subject: null, displayName: '', retentionUntil: '' });
  });

  it('exige fichier et nature', () => {
    expect(validateLibraryForm({ ...EMPTY_LIBRARY_FORM }, ORG, TODAY)).toEqual({ kind: 'Choisissez la nature du document.', file: 'Choisissez le fichier à déposer.' });
  });

  it('impose le mandat à un mandat et le bail à un bail, sans choix de type', () => {
    expect(validateLibraryForm(valid({ kind: 'mandate' }), ORG, TODAY).subject).toBe('Choisissez l’objet concerné.');
    expect(validateLibraryForm(valid({ kind: 'lease', subjectType: 'unit' }), ORG, TODAY).subject).toBe('Choisissez l’objet concerné.');
    expect(subjectOf(valid({ kind: 'mandate', subjectType: 'unit', targetId: 'm1' }), ORG)).toEqual({ type: 'mandate', id: 'm1' });
    expect(subjectOf(valid({ kind: 'lease', targetId: 'l1' }), ORG)).toEqual({ type: 'lease', id: 'l1' });
  });

  it('rattache à l’agence sans choix d’identifiant', () => {
    expect(subjectOf(valid({ subjectType: 'organization' }), ORG)).toEqual({ type: 'organization', id: ORG });
    expect(validateLibraryForm(valid({ subjectType: 'organization' }), null, TODAY).subject).toBe('Aucune agence n’est sélectionnée.');
  });

  it('borne le nom à 120 caractères', () => {
    expect(validateLibraryForm(valid({ displayName: 'a'.repeat(120) }), ORG, TODAY).displayName).toBeUndefined();
    expect(validateLibraryForm(valid({ displayName: 'a'.repeat(121) }), ORG, TODAY).displayName).toBe('120 caractères au maximum.');
  });

  it('exige une date de conservation valide et strictement postérieure à aujourd’hui', () => {
    expect(validateLibraryForm(valid({ retentionUntil: '2026-11-21' }), ORG, TODAY).retentionUntil).toBeUndefined();
    expect(validateLibraryForm(valid({ retentionUntil: TODAY }), ORG, TODAY).retentionUntil).toBe('La date de conservation doit être postérieure à aujourd’hui.');
    expect(validateLibraryForm(valid({ retentionUntil: '31/12/2031' }), ORG, TODAY).retentionUntil).toContain('date valide');
    expect(validateLibraryForm(valid({ retentionUntil: '2026-13-45' }), ORG, TODAY).retentionUntil).toContain('date valide');
  });

  it('renvoie un document avec validité vers les pièces de conformité', () => {
    expect(validateLibraryForm(valid({ kind: 'diagnostic', hasExpiry: true }), ORG, TODAY).expiry).toContain('pièce de conformité');
  });
});

describe('erreurs serveur du dépôt', () => {
  it('reporte les erreurs par champ et garde un message général sinon', () => {
    const fieldError = new ConformiteApiError('invalid', 'x', { status: 422, fieldMessages: { file: 'Ce fichier contient du code exécutable.', retention_until: 'validation.after', display_name: 'validation.max.string' } });
    expect(libraryFailure(fieldError)).toEqual({
      fields: { file: 'Ce fichier contient du code exécutable.', retentionUntil: 'La date de conservation doit être postérieure à aujourd’hui (AAAA-MM-JJ).', displayName: '120 caractères au maximum.' },
      general: null,
    });
    expect(libraryFailure(new ConformiteApiError('conflict', 'Ce fichier n’a pas fini son analyse.', { status: 409 }))).toEqual({ fields: {}, general: 'Ce fichier n’a pas fini son analyse.' });
    expect(libraryFailure(new Error('Réseau coupé')).general).toBe('Réseau coupé');
  });
});
