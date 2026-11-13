import { describe, expect, it } from 'vitest';

import { contrastRatio, over, type Rgb } from './contrast';
import { role, type ThemeName } from './helpers';

const TEXT_MIN = 4.5;
const NON_TEXT_MIN = 3;

function solid(theme: ThemeName, name: string, backdrop: string): Rgb {
  return over(role(theme, name), over(role(theme, backdrop), { r: 0, g: 0, b: 0 }));
}

function ratio(theme: ThemeName, foreground: string, background: string, backdrop = 'bg.surface'): number {
  const back = solid(theme, background, backdrop);
  return contrastRatio(over(role(theme, foreground), back), back);
}

const themes: ThemeName[] = ['light', 'dark'];

describe.each(themes)('contraste WCAG (%s)', (theme) => {
  it.each([
    ['text.default', 'bg.page'],
    ['text.default', 'bg.surface'],
    ['text.default', 'bg.muted'],
    ['text.muted', 'bg.page'],
    ['text.muted', 'bg.surface'],
    ['text.muted', 'bg.muted'],
    ['text.subtle', 'bg.page'],
    ['text.subtle', 'bg.surface'],
    ['text.subtle', 'bg.muted'],
    ['text.placeholder', 'bg.page'],
    ['text.placeholder', 'bg.surface'],
    ['text.placeholder', 'bg.muted'],
    ['text.danger', 'bg.page'],
    ['text.danger', 'bg.surface'],
    ['text.danger', 'bg.muted'],
    ['action.text', 'action.default'],
    ['action.text', 'action.hover'],
    ['action.text', 'action.pressed'],
    ['action.text', 'danger.default'],
    ['action.text', 'danger.hover'],
    ['accent.on', 'accent.default'],
    ['action.on-subtle', 'action.subtle'],
    ['info.text', 'info.bg'],
    ['success.text', 'success.bg'],
    ['warning.text', 'warning.bg'],
    ['danger.text', 'danger.bg'],
    ['tooltip.text', 'tooltip.bg'],
    ['nav.text', 'nav.bg'],
    ['nav.muted', 'nav.bg'],
    ['nav.active', 'nav.bg'],
    ['nav.active', 'nav.active-bg'],
  ])('%s sur %s ≥ 4,5:1', (foreground, background) => {
    const backdrop = background.startsWith('nav.') ? 'nav.bg' : 'bg.surface';
    expect(ratio(theme, foreground, background, backdrop)).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  it.each([
    ['border.control', 'bg.surface'],
    ['border.control', 'bg.page'],
    ['focus.ring', 'bg.surface'],
    ['focus.ring', 'bg.page'],
  ])('%s sur %s ≥ 3:1 (WCAG 1.4.11)', (foreground, background) => {
    expect(ratio(theme, foreground, background)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
  });
});
