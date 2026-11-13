import { describe, expect, it } from 'vitest';

import { buildModel } from '../scripts/model.mjs';
import type { Json, Source } from '../scripts/types.d.ts';

const scale: Json = { space: { $type: 'dimension', 4: { $value: '4px' } } };
const palette: Json = { palette: { $type: 'color', a: { 1: { $value: '#102030' }, 2: { $value: '{palette.a.1}' } } } };

function theme(value: Json): Json {
  return { color: { $type: 'color', bg: { page: { $value: value } } } };
}

function source(overrides: Partial<Source>): Source {
  return { palette, light: theme('{palette.a.1}'), dark: theme('{palette.a.2}'), scale, ...overrides };
}

describe('résolution des alias', () => {
  it('résout un alias direct et un alias en chaîne', () => {
    const model = buildModel(source({}));
    expect(model.roles.light[0]?.value).toEqual({ r: 16, g: 32, b: 48, a: 1 });
    expect(model.roles.dark[0]?.value).toEqual({ r: 16, g: 32, b: 48, a: 1 });
  });

  it('résout une couleur avec alpha', () => {
    const model = buildModel(source({ light: theme({ color: '{palette.a.1}', alpha: 0.5 }) }));
    expect(model.roles.light[0]?.value).toEqual({ r: 16, g: 32, b: 48, a: 0.5 });
  });

  it('refuse un alias introuvable en nommant le jeton fautif', () => {
    expect(() => buildModel(source({ light: theme('{palette.a.9}') }))).toThrow(
      'Alias introuvable : {palette.a.9} (référencé par color.bg.page)',
    );
  });

  it('refuse un alias cyclique', () => {
    const cyclic: Json = { palette: { $type: 'color', x: { $value: '{palette.y}' }, y: { $value: '{palette.x}' } } };
    expect(() => buildModel(source({ palette: cyclic, light: theme('{palette.x}') }))).toThrow(
      /Alias cyclique : color\.bg\.page → palette\.x → palette\.y → palette\.x/,
    );
  });

  it('refuse deux thèmes aux rôles différents', () => {
    const extra: Json = {
      color: { $type: 'color', bg: { page: { $value: '#000000' }, extra: { $value: '#111111' } } },
    };
    expect(() => buildModel(source({ dark: extra }))).toThrow(/absents du clair : \[color\.bg\.extra\]/);
  });

  it("refuse une valeur de couleur qui n'est pas un hexadécimal", () => {
    expect(() => buildModel(source({ light: theme('rouge') }))).toThrow(/Valeur de couleur invalide/);
  });

  it('refuse une dimension sans unité', () => {
    expect(() => buildModel(source({ scale: { space: { $type: 'dimension', 4: { $value: '4' } } } }))).toThrow(
      /Valeur invalide pour space\.4/,
    );
  });
});
