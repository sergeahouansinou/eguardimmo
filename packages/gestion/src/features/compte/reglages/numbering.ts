export function renderNumber(format: string, sample: Record<string, string>): string {
  return format.replace(/\{[^}]*\}/g, (token) => sample[token] ?? token);
}
