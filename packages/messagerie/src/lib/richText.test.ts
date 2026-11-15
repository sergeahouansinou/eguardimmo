import { describe, expect, it } from 'vitest';
import { parseRichText, stripRichText, toggleFormat } from './richText';

describe('toggleFormat', () => {
  it('entoure la sélection du marqueur', () => {
    expect(toggleFormat('Bonjour Marc', 8, 12, 'bold')).toEqual({ value: 'Bonjour **Marc**', selectionStart: 10, selectionEnd: 14 });
    expect(toggleFormat('Bonjour Marc', 0, 7, 'underline').value).toBe('__Bonjour__ Marc');
    expect(toggleFormat('Bonjour Marc', 8, 12, 'italic').value).toBe('Bonjour *Marc*');
  });

  it('retire le marqueur quand la sélection est déjà entourée', () => {
    expect(toggleFormat('Bonjour **Marc**', 10, 14, 'bold')).toEqual({ value: 'Bonjour Marc', selectionStart: 8, selectionEnd: 12 });
  });

  it('insère une paire de marqueurs sans sélection', () => {
    expect(toggleFormat('Bonjour ', 8, 8, 'bold')).toEqual({ value: 'Bonjour ****', selectionStart: 10, selectionEnd: 10 });
  });
});

describe('parseRichText', () => {
  it('reconnaît gras, italique et souligné', () => {
    expect(parseRichText('a **b** *c* __d__ e')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'bold', text: 'b' },
      { kind: 'text', text: ' ' },
      { kind: 'italic', text: 'c' },
      { kind: 'text', text: ' ' },
      { kind: 'underline', text: 'd' },
      { kind: 'text', text: ' e' },
    ]);
  });

  it('laisse intacts les marqueurs non fermés et le HTML saisi', () => {
    expect(parseRichText('2 * 3 <b>x</b>')).toEqual([{ kind: 'text', text: '2 * 3 <b>x</b>' }]);
  });

  it('retire les marqueurs pour les aperçus', () => {
    expect(stripRichText('**Urgent** : *coupure* d’eau')).toBe('Urgent : coupure d’eau');
  });
});
