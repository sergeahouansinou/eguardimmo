import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GestionDataModeProvider } from '../locataires';
import { createApiContactUpdatesSource } from './contactUpdates/api';
import { ContactUpdatesSourceProvider } from './contactUpdates/source';
import { TenantRequestsDigest } from './digest';
import { createApiInsuranceSource } from './insurance/api';
import { overview, submissionPending } from './insurance/fixtures';
import { InsuranceSourceProvider } from './insurance/source';
import { createApiNoticesSource } from './notices/api';
import { noticeLate, noticeRow } from './notices/fixtures';
import { NoticesSourceProvider } from './notices/source';
import { LeaseTenantRequests, TenantContactUpdates } from './sections';
import { IDS, cursorPage } from './testing/fixtures';
import { orgUrl, renderTenantRequests } from './testing/render';
import type { MockRoute, SourceContext } from './testing/render';

const noticesUrl = orgUrl('/notice-requests');
const insuranceUrl = orgUrl('/insurance-submissions');
const overviewUrl = orgUrl(`/leases/${IDS.lease}/insurance`);
const contactUrl = orgUrl(`/parties/${IDS.partyAwa}/contact-updates`);

function sources(context: SourceContext, children: React.ReactNode) {
  return (
    <NoticesSourceProvider source={createApiNoticesSource(context)}>
      <InsuranceSourceProvider source={createApiInsuranceSource(context)}>
        <ContactUpdatesSourceProvider source={createApiContactUpdatesSource(context)}>{children}</ContactUpdatesSourceProvider>
      </InsuranceSourceProvider>
    </NoticesSourceProvider>
  );
}

const leaseRoutes: Record<string, MockRoute> = {
  [`GET ${noticesUrl}`]: { body: cursorPage([noticeRow]) },
  [`GET ${overviewUrl}`]: { body: { data: overview } },
};

describe('bloc des demandes sur la fiche du bail', () => {
  it('signale les congés à accuser et propose les liens de gestion à un gestionnaire', async () => {
    renderTenantRequests((context) => sources(context, <LeaseTenantRequests leaseId={IDS.lease} />), leaseRoutes);

    expect(await screen.findByText('1 demande de congé sans accusé de réception sur ce bail')).toBeTruthy();
    const card = screen.getByRole('region', { name: 'Demandes et suivi du locataire' });
    expect(within(card).getByRole('link', { name: 'Demandes de congé' }).getAttribute('href')).toBe(`/baux/conges?bail=${IDS.lease}`);
    expect(within(card).getByRole('link', { name: 'États des lieux' })).toBeTruthy();
    expect(within(card).getByRole('link', { name: 'Paiements en ligne' }).getAttribute('href')).toBe(`/finances/paiements-en-ligne?bail=${IDS.lease}`);
    expect(await screen.findByText('Assurance habitation')).toBeTruthy();
  });

  it('ne montre au comptable que les paiements en ligne, sans interroger congés ni assurances', async () => {
    const { calls } = renderTenantRequests((context) => sources(context, <LeaseTenantRequests leaseId={IDS.lease} />), leaseRoutes, { role: 'accountant' });

    const card = await screen.findByRole('region', { name: 'Demandes et suivi du locataire' });
    expect(within(card).getByRole('link', { name: 'Paiements en ligne' })).toBeTruthy();
    expect(within(card).queryByRole('link', { name: 'Demandes de congé' })).toBeNull();
    expect(within(card).queryByRole('link', { name: 'États des lieux' })).toBeNull();
    expect(screen.queryByText('Assurance habitation')).toBeNull();
    expect(calls.filter((call) => call.path === noticesUrl || call.path === overviewUrl)).toHaveLength(0);
  });

  it('ne montre rien sans rôle reconnu', () => {
    const { container, calls } = renderTenantRequests((context) => sources(context, <LeaseTenantRequests leaseId={IDS.lease} />), leaseRoutes, { role: null });

    expect(container.textContent).toBe('');
    expect(calls).toHaveLength(0);
  });

  it('ne rend rien et n’appelle rien en mode démonstration', () => {
    const { container, calls } = renderTenantRequests(
      (context) => sources(context, (
        <GestionDataModeProvider mode="demo">
          <LeaseTenantRequests leaseId={IDS.lease} />
          <TenantContactUpdates partyId={IDS.partyAwa} />
        </GestionDataModeProvider>
      )),
      leaseRoutes,
    );

    expect(container.textContent).toBe('');
    expect(calls).toHaveLength(0);
  });
});

describe('demandes de changement de coordonnées sur la fiche du locataire', () => {
  it('interroge les demandes de ce locataire en mode api', async () => {
    const { callsTo } = renderTenantRequests((context) => sources(context, <TenantContactUpdates partyId={IDS.partyAwa} />), { [`GET ${contactUrl}`]: { body: cursorPage([]) } });

    await waitFor(() => { expect(callsTo('GET', contactUrl)).toHaveLength(1); });
  });
});

describe('synthèse des demandes sur l’accueil', () => {
  const digestRoutes: Record<string, MockRoute> = {
    [`GET ${noticesUrl}`]: { body: cursorPage([noticeRow, noticeLate]) },
    [`GET ${insuranceUrl}`]: { body: cursorPage([submissionPending]) },
  };

  it('compte les congés (dont les retards) et les attestations à examiner', async () => {
    renderTenantRequests((context) => sources(context, <TenantRequestsDigest />), digestRoutes);

    const card = await screen.findByRole('region', { name: 'Demandes des locataires à traiter' });
    expect(within(card).getByRole('link', { name: '2 demandes de congé sans accusé de réception' }).getAttribute('href')).toBe('/baux/conges');
    expect(within(card).getByText('1 est en retard')).toBeTruthy();
    expect(within(card).getByRole('link', { name: '1 attestation d’assurance à examiner' }).getAttribute('href')).toBe('/conformite/assurances');
  });

  it('reste vide quand rien n’attend', async () => {
    const { container, callsTo } = renderTenantRequests((context) => sources(context, <TenantRequestsDigest />), {
      [`GET ${noticesUrl}`]: { body: cursorPage([]) },
      [`GET ${insuranceUrl}`]: { body: cursorPage([]) },
    });

    await waitFor(() => { expect(callsTo('GET', insuranceUrl)).toHaveLength(1); });
    expect(container.textContent).toBe('');
  });

  it.each(['accountant', null])('n’interroge rien pour le rôle %s', (role) => {
    const { container, calls } = renderTenantRequests((context) => sources(context, <TenantRequestsDigest />), digestRoutes, { role });

    expect(container.textContent).toBe('');
    expect(calls).toHaveLength(0);
  });
});
