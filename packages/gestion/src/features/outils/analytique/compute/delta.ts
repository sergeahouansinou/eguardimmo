import { changePercent, formatDecimal, formatPercentValue, roundTenth } from '../format';

export type DeltaTone = 'good' | 'bad' | 'neutral';
export type DeltaDirection = 'up' | 'down' | 'flat';

export interface Delta {
  direction: DeltaDirection;
  tone: DeltaTone;
  text: string;
}

export type Polarity = 'up' | 'down';

function toneFor(direction: DeltaDirection, polarity: Polarity): DeltaTone {
  if (direction === 'flat') return 'neutral';
  return direction === polarity ? 'good' : 'bad';
}

export function percentDelta(current: number, previous: number, polarity: Polarity = 'up'): Delta | null {
  const change = changePercent(current, previous);
  if (change === null) return null;
  if (Math.abs(change) < 0.05) return { direction: 'flat', tone: 'neutral', text: 'stable' };
  const direction: DeltaDirection = change > 0 ? 'up' : 'down';
  return { direction, tone: toneFor(direction, polarity), text: formatPercentValue(Math.abs(change)) };
}

export function pointsDelta(current: number, previous: number, polarity: Polarity = 'up', digits = 0): Delta {
  const factor = 10 ** digits;
  const diff = Math.round(current * factor) / factor - Math.round(previous * factor) / factor;
  const rounded = digits === 0 ? Math.round(diff) : roundTenth(diff);
  if (rounded === 0) return { direction: 'flat', tone: 'neutral', text: 'stable' };
  const direction: DeltaDirection = rounded > 0 ? 'up' : 'down';
  const magnitude = Math.abs(rounded);
  return {
    direction,
    tone: toneFor(direction, polarity),
    text: `${formatDecimal(magnitude, digits)} pt${magnitude >= 2 ? 's' : ''}`,
  };
}
