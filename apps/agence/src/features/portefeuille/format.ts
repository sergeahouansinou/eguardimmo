export function formatDecimalInput(minor: number): string {
  const euros = minor / 100;
  return Number.isInteger(euros) ? String(euros) : euros.toFixed(2).replace(".", ",");
}
