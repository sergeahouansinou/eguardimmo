import { describe, expect, it } from 'vitest';
import { parseFormatted, toggleFormat } from './formatting';

describe('mise en forme du corps', () => {
  it('entoure la sélection puis la retrouve', () => {
    const bold = toggleFormat('Bonjour tout le monde', 8, 12, 'bold');
    expect(bold).toEqual({ value: 'Bonjour **tout** le monde', selectionStart: 10, selectionEnd: 14 });
    expect(toggleFormat(bold.value, bold.selectionStart, bold.selectionEnd, 'bold').value).toBe('Bonjour tout le monde');
    expect(toggleFormat('abc', 0, 3, 'italic').value).toBe('*abc*');
    expect(toggleFormat('abc', 0, 3, 'underline').value).toBe('__abc__');
  });

  it('insère des marqueurs vides à la position du curseur sans sélection', () => {
    expect(toggleFormat('ab', 1, 1, 'bold')).toEqual({ value: 'a****b', selectionStart: 3, selectionEnd: 3 });
  });

  it('découpe un texte en segments gras, italique et souligné', () => {
    expect(parseFormatted('Un **gras**, un *italique* et du __souligné__.')).toEqual([
      { kind: 'text', text: 'Un ' },
      { kind: 'bold', text: 'gras' },
      { kind: 'text', text: ', un ' },
      { kind: 'italic', text: 'italique' },
      { kind: 'text', text: ' et du ' },
      { kind: 'underline', text: 'souligné' },
      { kind: 'text', text: '.' },
    ]);
    expect(parseFormatted('sans marque')).toEqual([{ kind: 'text', text: 'sans marque' }]);
  });
});
