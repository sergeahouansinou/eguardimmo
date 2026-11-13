/** @typedef {import('./types.d.ts').RoleColor} RoleColor */

export const TAILWIND_COLOR_NAMES = {
  'bg.page': 'page',
  'bg.surface': 'surface',
  'bg.muted': 'muted',
  'bg.disabled': 'disabled',
  'border.default': 'line',
  'border.control': 'line-control',
  'border.strong': 'line-strong',
  'text.default': 'fg',
  'text.muted': 'fg-muted',
  'text.subtle': 'fg-subtle',
  'text.placeholder': 'fg-placeholder',
  'text.disabled': 'fg-disabled',
  'text.inverse': 'fg-inverse',
  'text.danger': 'fg-danger',
  'action.default': 'action',
  'action.hover': 'action-hover',
  'action.pressed': 'action-pressed',
  'action.subtle': 'action-subtle',
  'action.on-subtle': 'action-on-subtle',
  'action.text': 'on-action',
  'accent.default': 'accent',
  'accent.on': 'on-accent',
  'focus.ring': 'focus',
  'nav.bg': 'nav',
  'nav.text': 'nav-fg',
  'nav.muted': 'nav-muted',
  'nav.active': 'nav-active',
  'nav.active-bg': 'nav-active-bg',
  'info.bg': 'info',
  'info.border': 'info-line',
  'info.text': 'info-fg',
  'success.bg': 'success',
  'success.border': 'success-line',
  'success.text': 'success-fg',
  'warning.bg': 'warning',
  'warning.border': 'warning-line',
  'warning.text': 'warning-fg',
  'danger.bg': 'danger',
  'danger.border': 'danger-line',
  'danger.text': 'danger-fg',
  'danger.default': 'danger-solid',
  'danger.hover': 'danger-solid-hover',
  'tooltip.bg': 'tooltip',
  'tooltip.text': 'tooltip-fg',
  'chart.called': 'chart-called',
  'chart.collected': 'chart-collected',
  'chart.due': 'chart-due',
  'chart.grid': 'chart-grid',
  'chart.highlight': 'chart-highlight',
};

/**
 * Associe chaque rôle à son nom Tailwind ; échoue si un rôle n'a pas de nom,
 * si la table cite un rôle inconnu ou si deux rôles partagent un nom.
 * @param {RoleColor[]} roles
 * @returns {{ role: string; tailwind: string }[]}
 */
export function tailwindColors(roles) {
  /** @type {Record<string, string>} */
  const table = TAILWIND_COLOR_NAMES;
  const roleKeys = roles.map((role) => role.path.join('.'));
  const unnamed = roleKeys.filter((key) => table[key] === undefined);
  const unknown = Object.keys(table).filter((key) => !roleKeys.includes(key));
  if (unnamed.length > 0 || unknown.length > 0) {
    throw new Error(
      `Table des noms Tailwind incohérente. Rôles sans nom : [${unnamed.join(', ')}] ; noms pour un rôle inconnu : [${unknown.join(', ')}]`,
    );
  }
  const names = roleKeys.map((key) => table[key] ?? '');
  const duplicated = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicated.length > 0) {
    throw new Error(`Noms Tailwind en double : ${[...new Set(duplicated)].join(', ')}`);
  }
  return roleKeys.map((role, index) => ({ role, tailwind: names[index] ?? '' }));
}
