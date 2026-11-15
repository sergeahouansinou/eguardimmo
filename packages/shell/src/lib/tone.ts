import type { BadgeTone } from '@eguardimmo/ui';
import type { Tone } from '../data/schemas';

export const toneTile: Record<Tone, string> = {
  danger: 'bg-danger text-danger-fg',
  warning: 'bg-warning text-warning-fg',
  info: 'bg-info text-info-fg',
  success: 'bg-success text-success-fg',
  neutral: 'bg-muted text-fg-muted',
};

export const toneBadge: Record<Tone, BadgeTone> = {
  danger: 'danger',
  warning: 'warning',
  info: 'info',
  success: 'success',
  neutral: 'neutral',
};
