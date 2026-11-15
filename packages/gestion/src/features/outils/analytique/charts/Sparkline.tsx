import { TONE_FILL, TONE_STROKE } from './tones';
import type { SeriesTone } from './tones';

const WIDTH = 88;
const HEIGHT = 30;
const PAD_X = 2;
const PAD_Y = 3;
const DOT = 3;

export function sparklinePoints(values: readonly number[]): { x: number; y: number }[] {
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low;
  return values.map((value, index) => ({
    x: PAD_X + (index / Math.max(values.length - 1, 1)) * (WIDTH - 2 * PAD_X),
    y: span === 0 ? HEIGHT / 2 : PAD_Y + (1 - (value - low) / span) * (HEIGHT - 2 * PAD_Y),
  }));
}

export function Sparkline({ values, tone }: { values: readonly number[]; tone: SeriesTone }) {
  if (values.length < 2) return null;
  const points = sparklinePoints(values);
  const lastPoint = points.at(-1);
  return (
    <svg viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`} width={WIDTH} height={HEIGHT} aria-hidden="true" className="block flex-none">
      <polyline
        points={points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')}
        fill="none"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        className={TONE_STROKE[tone]}
      />
      {lastPoint ? <circle cx={lastPoint.x} cy={lastPoint.y} r={DOT} className={TONE_FILL[tone]} /> : null}
    </svg>
  );
}
