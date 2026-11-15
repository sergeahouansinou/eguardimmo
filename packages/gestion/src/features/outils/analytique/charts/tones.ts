export type SeriesTone = 'revenue' | 'expense' | 'muted' | 'due' | 'works';

export const TONE_FILL: Record<SeriesTone, string> = {
  revenue: 'fill-chart-collected',
  expense: 'fill-warning-line',
  muted: 'fill-chart-called',
  due: 'fill-chart-due',
  works: 'fill-nav',
};

export const TONE_STROKE: Record<SeriesTone, string> = {
  revenue: 'stroke-chart-collected',
  expense: 'stroke-warning-line',
  muted: 'stroke-chart-called',
  due: 'stroke-chart-due',
  works: 'stroke-nav',
};

export const TONE_BG: Record<SeriesTone, string> = {
  revenue: 'bg-chart-collected',
  expense: 'bg-warning-line',
  muted: 'bg-chart-called',
  due: 'bg-chart-due',
  works: 'bg-nav',
};

export const TONES: readonly SeriesTone[] = ['revenue', 'expense', 'muted', 'due', 'works'];
