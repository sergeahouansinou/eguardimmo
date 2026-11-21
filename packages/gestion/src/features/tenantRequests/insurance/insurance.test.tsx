import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { IDS, cursorPage } from '../testing/fixtures';
import { orgUrl, problem, renderTenantRequests } from '../testing/render';
import type { MockRoute } from '../testing/render';
import { createApiInsuranceSource } from './api';
import { SUBMISSION_IDS, overview, submissionAccepted, submissionPending, submissionRejected } from './fixtures';
import { InsurancePage } from './InsurancePage';
import { LeaseInsuranceCard } from './LeaseInsuranceCard';
import { InsuranceSourceProvider, useInsuranceSource } from './source';

const SLOW = { timeout: 4000 };
const listUrl = orgUrl('/insurance-submissions');
const acceptUrl = `${listUrl}/${SUBMISSION_IDS.pending}/accept`;
const rejectUrl = `${listUrl}/${SUBMISSION_IDS.pending}/reject`;
const reminderUrl = orgUrl(`/leases/${IDS.lease}/insurance/reminder`);
const overviewUrl = orgUrl(`/leases/${IDS.lease}/insurance`);
const fileUrl = orgUrl(`/insurance-submissions/${SUBMISSION_IDS.pending}/download`);

function renderInsurance(ui: 'page' | 'card', routes: Record<string, MockRoute>, options: { role?: string | null } = {}) {
  return renderTenantRequests(
    (context) => (
      <InsuranceSourceProvider source={createApiInsuranceSource(context)}>
        {ui === 'page' ? <InsurancePage /> : <LeaseInsuranceCard leaseId={IDS.lease} />}
      </InsuranceSourceProvider>
    ),
    routes,
    options,
  );
}

const listRoute = (items: readonly unknown[] = [submissionPending, submissionRejected, submissionAccepted]): Record<string, MockRoute> => ({ [`GET ${listUrl}`]: { body: cursorPage(items) } });

describe('assurances : liste', () => {
  it('affiche les dépôts avec locataire, bail, statut et motif, et masque les actions hors pending', async () => {
    const { container } = renderInsurance('page', listRoute());
    const table = await screen.findByRole('table', { name: 'Dépôts d’attestation d’assurance' }, SLOW);
    expect(await within(table).findAllByText('Awa Diallo', {}, SLOW)).toHaveLength(2);
    expect(within(table).getAllByText('BL-2026-0042')).toHaveLength(3);
    expect(within(table).getByText('À examiner')).toBeTruthy();
    expect(within(table).getByText('Document illisible')).toBeTruthy();
    expect(within(table).getAllByRole('button', { name: /^Accepter l’attestation de/ })).toHaveLength(1);
    expect(within(table).getAllByRole('button', { name: /^Refuser l’attestation de/ })).toHaveLength(1);
    expect(within(table).getAllByRole('button', { name: /^Voir l’attestation de/ })).toHaveLength(3);
    expect(within(table).getAllByRole('button', { name: /^Relancer le bail de/ })).toHaveLength(1);
    await expectNoA11yViolations(container);
  });

  it('filtre par statut côté serveur', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderInsurance('page', { [`GET ${listUrl}`]: (call) => ({ body: cursorPage(call.search.get('status') === 'rejected' ? [submissionRejected] : [submissionPending]) }) });
    await screen.findByRole('table', { name: 'Dépôts d’attestation d’assurance' }, SLOW);
    await user.click(screen.getByRole('combobox', { name: /Statut/ }));
    await user.click(await screen.findByRole('option', { name: 'Refusée' }));
    await waitFor(() => { expect(callsTo('GET', listUrl).some((call) => call.search.get('status') === 'rejected')).toBe(true); }, SLOW);
  });

  it('accepte un dépôt après confirmation', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderInsurance('page', { ...listRoute([submissionPending]), [`POST ${acceptUrl}`]: { body: { data: submissionAccepted } } });
    await user.click(await screen.findByRole('button', { name: /^Accepter l’attestation de Awa Diallo/ }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: 'Accepter cette attestation ?' });
    expect(within(dialog).getByText(/pièce de conformité/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Accepter l’attestation' }));
    await waitFor(() => { expect(callsTo('POST', acceptUrl)).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', acceptUrl)[0]?.body).toEqual({});
  });

  it('traduit le refus 409 d’un dépôt déjà traité', async () => {
    const user = userEvent.setup();
    renderInsurance('page', { ...listRoute([submissionPending]), [`POST ${acceptUrl}`]: problem(409, 'insurance_submission_not_pending', 'English detail') });
    await user.click(await screen.findByRole('button', { name: /^Accepter l’attestation de Awa Diallo/ }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: 'Accepter cette attestation ?' });
    await user.click(within(dialog).getByRole('button', { name: 'Accepter l’attestation' }));
    expect(await within(dialog).findByText(/a déjà été traité/, {}, SLOW)).toBeTruthy();
    expect(within(dialog).queryByText('English detail')).toBeNull();
  });

  it('refuse avec le motif de la liste fermée et la note, corps exact', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderInsurance('page', { ...listRoute([submissionPending]), [`POST ${rejectUrl}`]: { body: { data: submissionRejected } } });
    await user.click(await screen.findByRole('button', { name: /^Refuser l’attestation de Awa Diallo/ }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: /Refuser l’attestation de Awa Diallo/ });
    await user.click(within(dialog).getByRole('combobox', { name: /Motif du refus/ }));
    await user.click(await screen.findByRole('option', { name: 'Adresse du logement différente' }));
    await user.type(within(dialog).getByLabelText('Note pour le locataire'), 'Adresse de Lyon');
    expect(within(dialog).getByText('15 / 500 caractères')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Refuser l’attestation' }));
    await waitFor(() => { expect(callsTo('POST', rejectUrl)).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', rejectUrl)[0]?.body).toEqual({ reason: 'wrong_address', note: 'Adresse de Lyon' });
  });

  it('exige un motif et borne la note à 500 caractères, sans appel', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderInsurance('page', listRoute([submissionPending]));
    await user.click(await screen.findByRole('button', { name: /^Refuser l’attestation de Awa Diallo/ }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: /Refuser l’attestation de Awa Diallo/ });
    await user.click(within(dialog).getByRole('button', { name: 'Refuser l’attestation' }));
    expect(await within(dialog).findByText('Choisissez le motif du refus.')).toBeTruthy();
    await user.click(within(dialog).getByRole('combobox', { name: /Motif du refus/ }));
    await user.click(await screen.findByRole('option', { name: 'Autre motif' }));
    await user.click(within(dialog).getByLabelText('Note pour le locataire'));
    await user.paste('x'.repeat(501));
    await user.click(within(dialog).getByRole('button', { name: 'Refuser l’attestation' }));
    expect(await within(dialog).findByText('La note ne peut pas dépasser 500 caractères.')).toBeTruthy();
    expect(callsTo('POST', rejectUrl)).toHaveLength(0);
  });

  it('affiche l’attestation dans un dialogue sans passer par dangerouslySetInnerHTML', async () => {
    const user = userEvent.setup();
    URL.createObjectURL = () => 'blob:attestation';
    URL.revokeObjectURL = () => undefined;
    const { callsTo } = renderInsurance('page', { ...listRoute([submissionPending]), [`GET ${fileUrl}`]: { file: { type: 'application/pdf', content: '%PDF-1.4' } } });
    await user.click(await screen.findByRole('button', { name: /^Voir l’attestation de Awa Diallo/ }, SLOW));
    const frame = await screen.findByTitle('Attestation d’assurance déposée par le locataire', {}, SLOW);
    expect(frame.tagName).toBe('IFRAME');
    expect(callsTo('GET', fileUrl)).toHaveLength(1);
  });

  it('relance le bail d’un dépôt refusé et traduit le 429', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderInsurance('page', { ...listRoute([submissionRejected]), [`POST ${reminderUrl}`]: problem(429, 'insurance_reminder_too_soon', 'English detail') });
    await user.click(await screen.findByRole('button', { name: /^Relancer le bail de Marc Chevalier/ }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: 'Relancer les locataires de ce bail ?' });
    expect(within(dialog).getByText(/n’est pas une mise en demeure/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Envoyer la relance' }));
    expect(await within(dialog).findByText(/Une relance a déjà été envoyée/, {}, SLOW)).toBeTruthy();
    expect(callsTo('POST', reminderUrl)).toHaveLength(1);
  });

  it('refuse le comptable sans appeler le serveur', async () => {
    const { calls } = renderInsurance('page', listRoute(), { role: 'accountant' });
    expect(await screen.findByText('Page indisponible pour votre rôle', {}, SLOW)).toBeTruthy();
    expect(calls.filter((call) => call.path === listUrl)).toHaveLength(0);
  });

  it('affiche l’état vide, l’erreur de chargement et le 403', async () => {
    const empty = renderInsurance('page', listRoute([]));
    expect(await screen.findByText(/Aucun dépôt/, {}, SLOW)).toBeTruthy();
    empty.unmount();
    const failed = renderInsurance('page', { [`GET ${listUrl}`]: problem(500, 'server_error') });
    expect(await screen.findByText('Impossible de charger les dépôts d’attestation', {}, SLOW)).toBeTruthy();
    failed.unmount();
    renderInsurance('page', { [`GET ${listUrl}`]: problem(403, 'forbidden') });
    expect(await screen.findByText('Impossible de charger les dépôts d’attestation', {}, SLOW)).toBeTruthy();
  });

  it('lève en mode api quand la source n’est pas montée', () => {
    function Probe() {
      useInsuranceSource();
      return null;
    }
    const render = () => renderTenantRequests(() => <Probe />, {});
    expect(render).toThrow(/Aucune source/);
  });
});

describe('assurances : carte du bail', () => {
  it('affiche la couverture, les dépôts et relance', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderInsurance('card', { [`GET ${overviewUrl}`]: { body: { data: overview } }, [`POST ${reminderUrl}`]: { status: 202, body: { data: { status: 'sent' } } } });
    expect(await screen.findByText('Couverture bientôt échue', {}, SLOW)).toBeTruthy();
    expect(screen.getByText('jusqu’au 15/12/2026')).toBeTruthy();
    const list = await screen.findByRole('list', { name: 'Dépôts d’attestation du bail' });
    expect(await within(list).findByText('Awa Diallo', {}, SLOW)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Relancer les locataires' }));
    const dialog = await screen.findByRole('dialog', { name: 'Relancer les locataires de ce bail ?' });
    await user.click(within(dialog).getByRole('button', { name: 'Envoyer la relance' }));
    await waitFor(() => { expect(callsTo('POST', reminderUrl)).toHaveLength(1); }, SLOW);
  });

  it('ne s’affiche pas et n’appelle rien pour le comptable', async () => {
    const { calls, container } = renderInsurance('card', { [`GET ${overviewUrl}`]: { body: { data: overview } } }, { role: 'accountant' });
    await waitFor(() => { expect(container.textContent).toBe(''); });
    expect(calls.filter((call) => call.path === overviewUrl)).toHaveLength(0);
  });
});
