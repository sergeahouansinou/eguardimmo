import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FROZEN_NOW, renderLot } from '../../../test/lots';
import { EtatLieuxPage } from '../baux/EtatLieuxPage';
import { ReservationContratPage } from '../baux/ReservationContratPage';
import { AttestationApercuPage } from './AttestationApercuPage';
import { AvisEcheanceApercuPage } from './AvisEcheanceApercuPage';
import { CourrierApercuPage } from './CourrierApercuPage';
import { demoNoticeIds, demoReceiptIds, demoTemplateIds } from './demo';
import { ModeleApercuPage } from './ModeleApercuPage';
import { QuittanceApercuPage } from './QuittanceApercuPage';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN_NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

const firstOf = (ids: readonly string[]): string => ids[0] ?? '';

const papers: [string, ReactElement][] = [
  ['quittance', <QuittanceApercuPage key="q" id={firstOf(demoReceiptIds)} />],
  ['avis d’échéance', <AvisEcheanceApercuPage key="a" id={firstOf(demoNoticeIds)} />],
  ['attestation', <AttestationApercuPage key="t" id="at-2023-0018" />],
  ['courrier', <CourrierApercuPage key="c" id="cr-2026-0041" />],
  ['modèle', <ModeleApercuPage key="m" id={firstOf(demoTemplateIds)} />],
  ['état des lieux', <EtatLieuxPage key="e" id="edl-2023-002" />],
  ['contrat de location', <ReservationContratPage key="r" id="rs-2026-031" />],
];

describe('Papiers A4, restent blancs en mode sombre', () => {
  it('la feuille de style du design system force le papier clair', () => {
    const css = readFileSync(resolve(process.cwd(), '../ui/src/paper.css'), 'utf8');
    expect(css).toContain('[data-paper]');
    expect(css).toContain('color-scheme: light');
  });


  it.each(papers)('le papier « %s » porte le marquage papier clair', async (_name, page) => {
    renderLot(page);
    await waitFor(() => { expect(document.querySelector('[data-paper]')).not.toBeNull(); });
    expect(screen.queryByText('Introuvable')).toBeNull();
  });
});
