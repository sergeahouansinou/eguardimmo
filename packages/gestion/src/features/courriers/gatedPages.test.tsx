import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, screen } from '@testing-library/react';
import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider, TooltipProvider } from '@eguardimmo/ui';
import { BauxSourceProvider } from '../baux';
import { createApiBauxSource } from '../baux/api/apiSource';
import { mockApi } from '../baux/api/testing';
import { EtatLieuxPage, ReservationContratPage } from '../baux/gatedPages';
import { GestionDataModeProvider, GestionNavigationProvider, LocatairesSourceProvider, MissingSourceError, createDemoLocatairesSource } from '../locataires';
import {
  AttestationApercuPage,
  AvisEcheanceApercuPage,
  AvisEcheancePage,
  CourrierApercuPage,
  CourrierFormPage,
  CourriersPage,
  CourriersSourceProvider,
  ModeleApercuPage,
  ModeleFormPage,
  ModelesPage,
  QuittanceApercuPage,
  QuittancesPage,
  SignatureNewPage,
  SignaturesPage,
  createUnavailableCourriersSource,
} from './index';
import { useCourriersSource } from './source';

function Link({ href, children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a href={href} {...props}>{children}</a>;
}

function renderApiMode(ui: ReactElement) {
  const mock = mockApi({});
  const baux = createApiBauxSource({ client: mock.client, organizationId: '0b5f2c1e-6d7a-4c8e-9a41-2f6d8e7c1a10' });
  const view = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TooltipProvider>
        <ToastProvider>
          <GestionDataModeProvider mode="api">
            <GestionNavigationProvider value={{ Link, push: vi.fn(), search: new URLSearchParams() }}>
              <LocatairesSourceProvider source={createDemoLocatairesSource()}>
                <BauxSourceProvider source={baux}>
                  <CourriersSourceProvider source={createUnavailableCourriersSource()}>{ui}</CourriersSourceProvider>
                </BauxSourceProvider>
              </LocatairesSourceProvider>
            </GestionNavigationProvider>
          </GestionDataModeProvider>
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { ...view, calls: mock.calls };
}

describe('courriers en mode api', () => {
  it.each([
    ['quittances', <QuittancesPage key="a" />],
    ['aperçu d’une quittance', <QuittanceApercuPage key="b" id="qt-2026-0398" />],
    ['avis d’échéance', <AvisEcheancePage key="c" />],
    ['aperçu d’un avis', <AvisEcheanceApercuPage key="d" id="av-20261201-apt-a1" />],
    ['attestation de restitution', <AttestationApercuPage key="e" id="att-1" />],
    ['signatures', <SignaturesPage key="f" />],
    ['nouvelle signature', <SignatureNewPage key="g" />],
    ['courriers', <CourriersPage key="h" />],
    ['nouveau courrier', <CourrierFormPage key="i" />],
    ['aperçu d’un courrier', <CourrierApercuPage key="j" id="c-1" />],
    ['modèles', <ModelesPage key="k" />],
    ['nouveau modèle', <ModeleFormPage key="l" />],
    ['aperçu d’un modèle', <ModeleApercuPage key="m" id="m-1" />],
    ['contrat de réservation', <ReservationContratPage key="n" id="res-1" />],
    ['état des lieux', <EtatLieuxPage key="o" id="edl-1" />],
  ])('%s : « Bientôt disponible », sans donnée de démonstration ni bailleur fictif', (_name, page) => {
    const { calls } = renderApiMode(page);

    expect(screen.getByText('Bientôt disponible')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(document.body.textContent).not.toContain('SCI Les Tilleuls');
    expect(calls).toHaveLength(0);
  });
});

describe('contexte de source', () => {
  const wrapper = (mode: 'demo' | 'api') => ({ children }: { children: ReactNode }) => <GestionDataModeProvider mode={mode}>{children}</GestionDataModeProvider>;

  it('refuse explicitement de retomber sur la démonstration en mode api sans fournisseur', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useCourriersSource(), { wrapper: wrapper('api') })).toThrow(MissingSourceError);
    vi.restoreAllMocks();
  });

  it('garde la démonstration par défaut et en mode demo', () => {
    expect(renderHook(() => useCourriersSource()).result.current.unavailableInApiMode).toBe(false);
    expect(renderHook(() => useCourriersSource(), { wrapper: wrapper('demo') }).result.current.unavailableInApiMode).toBe(false);
  });

  it('sert la source fournie en mode api', () => {
    const provided = createUnavailableCourriersSource();
    const { result } = renderHook(() => useCourriersSource(), {
      wrapper: ({ children }) => (
        <GestionDataModeProvider mode="api">
          <CourriersSourceProvider source={provided}>{children}</CourriersSourceProvider>
        </GestionDataModeProvider>
      ),
    });
    expect(result.current).toBe(provided);
  });
});

describe('source de courriers indisponible', () => {
  it('rejette chaque opération au lieu de répondre avec des données', async () => {
    const source = createUnavailableCourriersSource();
    await expect(source.receipts()).rejects.toThrow('ne sont pas encore reliés au serveur');
    await expect(source.emitReceipts('2026-11')).rejects.toThrow('ne sont pas encore reliés au serveur');
    await expect(source.createSignature({})).rejects.toThrow('ne sont pas encore reliés au serveur');
  });
});
