export function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = [1, 2, 2.5, 5, 10].find((candidate) => candidate * power >= raw) ?? 10;
  return unit * power;
}

export interface NiceScale {
  step: number;
  top: number;
  ticks: number;
}

export function niceScale(peak: number, ticks = 4): NiceScale {
  const step = niceStep(Math.max(peak, 0) / ticks);
  return { step, top: step * ticks, ticks };
}

export function roundedTopPath(x: number, y: number, width: number, bottom: number): string {
  const radius = Math.min(4, (bottom - y) / 2, width / 2);
  const f = (value: number) => String(Math.round(value * 100) / 100);
  return `M${f(x)},${f(bottom)}V${f(y + radius)}Q${f(x)},${f(y)} ${f(x + radius)},${f(y)}H${f(x + width - radius)}Q${f(x + width)},${f(y)} ${f(x + width)},${f(y + radius)}V${f(bottom)}Z`;
}

export function labelEvery(count: number, plotWidth: number, labelWidth = 30): number {
  if (count <= 0) return 1;
  return Math.max(1, Math.ceil((count * labelWidth) / Math.max(plotWidth, 1)));
}

export function showLabel(index: number, count: number, every: number): boolean {
  return (count - 1 - index) % every === 0;
}
