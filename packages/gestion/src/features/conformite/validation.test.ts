import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, downloadName, extensionOf, fileProblem } from './files';
import { isIsoDate, validateCertificate, valuesPayload } from './validation';
import type { ValueField } from './model';

describe('fichiers', () => {
  it.each([
    ['application/pdf', 1024, null],
    ['image/jpeg', 1, null],
    ['image/png', 1, null],
    ['image/webp', 1, null],
    ['application/pdf', MAX_FILE_BYTES, null],
  ] as const)('accepte %s de %s octets', (type, size, expected) => {
    expect(fileProblem({ type, size })).toBe(expected);
  });

  it.each([
    ['application/zip', 10],
    ['text/html', 10],
    ['image/svg+xml', 10],
    ['application/x-php', 10],
    ['', 10],
  ])('refuse le type %s', (type, size) => {
    expect(fileProblem({ type, size })).toContain('pas accepté');
  });

  it('refuse un fichier vide ou de plus de 10 Mo', () => {
    expect(fileProblem({ type: 'application/pdf', size: 0 })).toBe('Ce fichier est vide.');
    expect(fileProblem({ type: 'application/pdf', size: MAX_FILE_BYTES + 1 })).toBe('Ce fichier dépasse 10 Mo.');
  });

  it('nomme le téléchargement sans jamais reprendre un nom ou un chemin fourni par l’utilisateur', () => {
    expect(downloadName(['Diagnostic gaz', '../../etc/passwd'], 'application/pdf')).toBe('Diagnostic-gaz-etc-passwd.pdf');
    expect(downloadName(['Entretien de la chaudière', 'CH-2025'], 'image/png')).toBe('Entretien-de-la-chaudiere-CH-2025.png');
    expect(downloadName([null, '   '], 'application/pdf')).toBe('piece.pdf');
    expect(downloadName(['a'.repeat(300)], 'application/pdf').length).toBeLessThanOrEqual(84);
  });

  it('déduit l’extension du type MIME du serveur', () => {
    expect(extensionOf('application/pdf; charset=binary')).toBe('pdf');
    expect(extensionOf('image/jpeg')).toBe('jpg');
    expect(extensionOf('text/html')).toBe('bin');
  });
});

describe('dates', () => {
  it.each([['2026-11-16', true], ['2026-02-29', false], ['16/11/2026', false], ['2026-13-01', false], ['', false]])('%s → %s', (value, expected) => {
    expect(isIsoDate(value)).toBe(expected);
  });
});

const field = (overrides: Partial<ValueField>): ValueField => ({ key: 'champ', kind: 'string', required: false, options: null, min: null, max: null, ...overrides });
const base = { reference: '', issuedOn: '2026-11-01', expiresOn: '', values: {}, file: null };

describe('validation des pièces', () => {
  it('ne signale rien sur une saisie valide', () => {
    expect(validateCertificate({ ...base, expiresOn: '2027-11-01' }, { fields: [] }, { fileRequired: false })).toEqual({});
  });

  it('refuse une échéance antérieure à l’émission, une référence trop longue et un type absent', () => {
    expect(validateCertificate({ ...base, expiresOn: '2026-10-31', reference: 'x'.repeat(121) }, null, { fileRequired: false })).toEqual({
      typeId: 'Choisissez le type de pièce.',
      reference: 'La référence est trop longue (120 caractères au plus).',
      expiresOn: 'L’échéance ne peut pas précéder la date d’émission.',
    });
  });

  it('exige le justificatif quand c’est demandé', () => {
    expect(validateCertificate(base, { fields: [] }, { fileRequired: true }).file).toBe('Joignez le justificatif de la pièce.');
  });

  it.each([
    [field({ kind: 'integer', min: 0 }), '-1', 'La valeur minimale est 0.'],
    [field({ kind: 'integer' }), '1.5', 'Saisissez un nombre entier.'],
    [field({ kind: 'integer', max: 10 }), '11', 'La valeur maximale est 10.'],
    [field({ kind: 'number' }), 'abc', 'Saisissez un nombre.'],
    [field({ kind: 'date' }), '2026-02-30', 'Saisissez une date valide (AAAA-MM-JJ).'],
    [field({ kind: 'boolean' }), 'peut-être', 'Choisissez oui ou non.'],
    [field({ options: ['A', 'B'] }), 'Z', 'Choisissez une valeur de la liste.'],
    [field({ required: true }), '  ', 'Ce champ est obligatoire.'],
  ] as const)('refuse la valeur %#', (definition, raw, message) => {
    expect(validateCertificate({ ...base, values: { champ: raw } }, { fields: [definition] }, { fileRequired: false })['values.champ']).toBe(message);
  });

  it('convertit les valeurs selon leur type et omet les champs vides', () => {
    const fields = [field({ key: 'a', kind: 'integer' }), field({ key: 'b', kind: 'boolean' }), field({ key: 'c' }), field({ key: 'd', kind: 'number' }), field({ key: 'e' })];
    expect(valuesPayload(fields, { a: '1500000', b: 'true', c: ' texte ', d: '12.5', e: '' })).toEqual({ a: 1500000, b: true, c: 'texte', d: 12.5 });
  });
});
