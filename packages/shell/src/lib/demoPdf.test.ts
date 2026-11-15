import { describe, expect, it } from 'vitest';
import { buildDemoPdf } from './demoPdf';

describe('demoPdf', () => {
  it('produit un PDF structuré avec le titre', () => {
    const pdf = buildDemoPdf('Quittance de loyer', ['Octobre 2026']);
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(pdf).toContain('Quittance de loyer');
  });
});
