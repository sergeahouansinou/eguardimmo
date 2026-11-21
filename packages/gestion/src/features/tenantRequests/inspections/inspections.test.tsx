import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { MissingSourceError } from '../../locataires';
import { IDS, cursorPage, leaseSummary } from '../testing/fixtures';
import { orgUrl, problem, renderTenantRequests } from '../testing/render';
import type { MockRoute } from '../testing/render';
import { createApiInspectionsSource } from './api';
import { INSPECTION_IDS, inspectionEntry, inspectionExit } from './fixtures';
import { InspectionFormPage } from './InspectionFormPage';
import { InspectionsPage } from './InspectionsPage';
import { InspectionsSourceProvider } from './source';

const SLOW = { timeout: 4000 };
const leaseInspections = orgUrl(`/leases/${IDS.lease}/inspections`);
const leasesUrl = orgUrl('/leases');

function renderPage(page: 'list' | 'form', routes: Record<string, MockRoute>, options: { role?: string | null; search?: string } = {}) {
  return renderTenantRequests(
    (context) => (
      <InspectionsSourceProvider source={createApiInspectionsSource(context)}>
        {page === 'list' ? <InspectionsPage /> : <InspectionFormPage />}
      </InspectionsSourceProvider>
    ),
    { [`GET ${leasesUrl}`]: { body: cursorPage([leaseSummary]) }, ...routes },
    options,
  );
}

const search = `bail=${IDS.lease}`;

describe('états des lieux : liste', () => {
  it('liste les états des lieux du bail avec type, auteur et statut', async () => {
    const { container } = renderPage('list', { [`GET ${leaseInspections}`]: { body: cursorPage([inspectionEntry, inspectionExit]) } }, { search });
    const table = await screen.findByRole('table', { name: 'États des lieux du bail' }, SLOW);
    expect(within(table).getByRole('link', { name: 'Entrée' }).getAttribute('href')).toBe(`/baux/etats-des-lieux/${INSPECTION_IDS.entry}`);
    expect(within(table).getByRole('link', { name: 'Sortie' })).toBeTruthy();
    expect(within(table).getAllByText('Brouillon')).toHaveLength(2);
    expect(within(table).getAllByText('L’agence')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Nouvel état des lieux' }).getAttribute('href')).toBe(`/baux/etats-des-lieux/nouveau?bail=${IDS.lease}`);
    await expectNoA11yViolations(container);
  });

  it('demande de choisir un bail et navigue vers ses états des lieux', async () => {
    const user = userEvent.setup();
    const { calls, push } = renderPage('list', {});
    expect(await screen.findByText('Choisissez un bail pour voir ses états des lieux.', {}, SLOW)).toBeTruthy();
    expect(calls.filter((call) => call.path === leaseInspections)).toHaveLength(0);
    expect(screen.queryByRole('link', { name: 'Nouvel état des lieux' })).toBeNull();
    await user.click(screen.getByRole('combobox', { name: /Bail/ }));
    await user.click(await screen.findByRole('option', { name: /BL-2026-0042/ }, SLOW));
    expect(push).toHaveBeenCalledWith(`/baux/etats-des-lieux?bail=${IDS.lease}`);
  });

  it('affiche l’état vide et l’erreur de chargement', async () => {
    const { unmount } = renderPage('list', { [`GET ${leaseInspections}`]: { body: cursorPage([]) } }, { search });
    expect(await screen.findByText(/Aucun état des lieux pour ce bail/, {}, SLOW)).toBeTruthy();
    unmount();
    renderPage('list', { [`GET ${leaseInspections}`]: problem(500, 'server_error') }, { search });
    expect(await screen.findByText('Impossible de charger les états des lieux', {}, SLOW)).toBeTruthy();
  });

  it('refuse le comptable sans appeler le serveur', async () => {
    const { calls } = renderPage('list', {}, { role: 'accountant', search });
    expect(await screen.findByText('Page indisponible pour votre rôle')).toBeTruthy();
    expect(calls.filter((call) => call.path === leaseInspections)).toHaveLength(0);
  });

  it('lève une erreur plutôt que d’afficher des données de démonstration sans source en mode api', () => {
    const silence = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderTenantRequests(() => <InspectionsPage />, {}, { search })).toThrow(MissingSourceError);
    silence.mockRestore();
  });
});

describe('états des lieux : enregistrement', () => {
  const pdf = () => new File(['%PDF-1.7'], 'edl-entree.pdf', { type: 'application/pdf' });
  const sentForm = (fetchImpl: typeof fetch): FormData | null => {
    const call = vi.mocked(fetchImpl).mock.calls.find(([input, init]) => init?.method === 'POST' && typeof input === 'string' && input.endsWith(`/leases/${IDS.lease}/inspections`));
    return call?.[1]?.body instanceof FormData ? call[1].body : null;
  };

  it('envoie le PDF, les champs et les signataires en multipart puis ouvre la fiche', async () => {
    const user = userEvent.setup();
    const { fetchImpl, push } = renderPage('form', { [`POST ${leaseInspections}`]: { status: 201, body: { data: inspectionEntry } } }, { search });
    await screen.findByRole('button', { name: 'Enregistrer l’état des lieux' }, SLOW);
    fireEvent.change(screen.getByLabelText(/Réalisé le/), { target: { value: '2026-01-03' } });
    await user.upload(screen.getByLabelText(/PDF de l’état des lieux/), pdf());
    await user.click(screen.getByRole('button', { name: 'Ajouter un signataire' }));
    fireEvent.change(screen.getByLabelText('Nom du signataire 1'), { target: { value: 'Awa Diallo' } });
    fireEvent.change(screen.getByLabelText('Qualité du signataire 1'), { target: { value: 'Locataire' } });
    fireEvent.change(screen.getByLabelText('Date de signature 1'), { target: { value: '2026-01-03' } });
    await user.click(screen.getByRole('button', { name: 'Enregistrer l’état des lieux' }));

    await waitFor(() => { expect(push).toHaveBeenCalledWith(`/baux/etats-des-lieux/${INSPECTION_IDS.entry}`); }, SLOW);
    const form = sentForm(fetchImpl);
    expect(form?.get('kind')).toBe('entry');
    expect(form?.get('performed_on')).toBe('2026-01-03');
    expect(form?.get('performed_by')).toBe('parties');
    expect(form?.get('signatories[0][name]')).toBe('Awa Diallo');
    expect(form?.get('signatories[0][capacity]')).toBe('Locataire');
    expect(form?.get('signatories[0][date]')).toBe('2026-01-03');
    expect(form?.has('exit_matches_entry')).toBe(false);
    expect(form?.get('file')).toBeInstanceOf(File);
    expect(form?.get('client_id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('refuse l’envoi sans PDF, sans appeler le serveur', async () => {
    const user = userEvent.setup();
    const { fetchImpl } = renderPage('form', {}, { search });
    await screen.findByRole('button', { name: 'Enregistrer l’état des lieux' }, SLOW);
    fireEvent.change(screen.getByLabelText(/Réalisé le/), { target: { value: '2026-01-03' } });
    await user.click(screen.getByRole('button', { name: 'Enregistrer l’état des lieux' }));
    expect(await screen.findByText('Joignez le PDF de l’état des lieux.')).toBeTruthy();
    expect(sentForm(fetchImpl)).toBeNull();
  });

  it('refuse une date de réalisation dans le futur', async () => {
    const user = userEvent.setup();
    const { fetchImpl } = renderPage('form', {}, { search });
    await screen.findByRole('button', { name: 'Enregistrer l’état des lieux' }, SLOW);
    fireEvent.change(screen.getByLabelText(/Réalisé le/), { target: { value: '2999-01-01' } });
    await user.upload(screen.getByLabelText(/PDF de l’état des lieux/), pdf());
    await user.click(screen.getByRole('button', { name: 'Enregistrer l’état des lieux' }));
    expect(await screen.findByText('Date de réalisation : elle ne peut pas être dans le futur.')).toBeTruthy();
    expect(sentForm(fetchImpl)).toBeNull();
  });

  it('traduit un rejeu au contenu différent (409) en français', async () => {
    const user = userEvent.setup();
    renderPage('form', { [`POST ${leaseInspections}`]: problem(409, 'idempotency_key_reused', 'English detail') }, { search });
    await screen.findByRole('button', { name: 'Enregistrer l’état des lieux' }, SLOW);
    fireEvent.change(screen.getByLabelText(/Réalisé le/), { target: { value: '2026-01-03' } });
    await user.upload(screen.getByLabelText(/PDF de l’état des lieux/), pdf());
    await user.click(screen.getByRole('button', { name: 'Enregistrer l’état des lieux' }));
    expect(await screen.findByText(/déjà été enregistrée avec un contenu différent/, {}, SLOW)).toBeTruthy();
    expect(screen.queryByText('English detail')).toBeNull();
  });

  it('propose la conformité seulement pour une sortie et l’envoie', async () => {
    const user = userEvent.setup();
    const { fetchImpl } = renderPage('form', { [`POST ${leaseInspections}`]: { status: 201, body: { data: inspectionExit } } }, { search });
    await screen.findByRole('button', { name: 'Enregistrer l’état des lieux' }, SLOW);
    expect(screen.queryByRole('combobox', { name: /Conformité/ })).toBeNull();
    await user.click(screen.getByRole('combobox', { name: /Type/ }));
    await user.click(await screen.findByRole('option', { name: 'État des lieux de sortie' }));
    await user.click(await screen.findByRole('combobox', { name: /Conformité/ }));
    await user.click(await screen.findByRole('option', { name: 'Conforme à l’état d’entrée' }));
    fireEvent.change(screen.getByLabelText(/Réalisé le/), { target: { value: '2026-11-10' } });
    await user.upload(screen.getByLabelText(/PDF de l’état des lieux/), pdf());
    await user.click(screen.getByRole('button', { name: 'Enregistrer l’état des lieux' }));
    await waitFor(() => { expect(sentForm(fetchImpl)?.get('kind')).toBe('exit'); }, SLOW);
    expect(sentForm(fetchImpl)?.get('exit_matches_entry')).toBe('1');
  });

  it('refuse proprement le comptable', async () => {
    renderPage('form', {}, { role: 'accountant', search });
    expect(await screen.findByText('Page indisponible pour votre rôle')).toBeTruthy();
  });
});
