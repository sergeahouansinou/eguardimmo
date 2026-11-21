import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import * as api from './api/responses.fixtures';
import { StatementPage } from './StatementPage';
import { saveBlob } from '../rent/download';
import { chargesUrl, problem, renderCharges } from './testing';
import type { MockRoute } from './api/testing';

vi.mock('../rent/download', () => ({ saveBlob: vi.fn() }));

const SLOW = { timeout: 4000 };
const statementUrl = (suffix = '') => chargesUrl(`/statements/${api.IDS.statement}${suffix}`);
const routes = (body: unknown = api.statement, extra: Record<string, MockRoute> = {}): Record<string, MockRoute> => ({ [`GET ${statementUrl()}`]: { body: { data: body } }, ...extra });

describe('décompte', () => {
  it('affiche la synthèse signée, les lignes par poste et les pièces', async () => {
    const { container } = renderCharges(<StatementPage id={api.IDS.statement} />, routes());
    expect(await screen.findByRole('heading', { name: 'Décompte DC-2026-0001' }, SLOW)).toBeTruthy();
    const table = await screen.findByRole('table', { name: 'Lignes du décompte' });
    await waitFor(() => { expect(norm(table.textContent)).toContain('Entretien des parties communes'); }, SLOW);
    const text = norm(document.body.textContent);

    expect(text).toContain('À rendre au locataire : 80 €');
    expect(text).toContain('Tantièmes 640/1 000');
    expect(text).toContain('Facture de nettoyage');
    expect(text).toContain('Crédit repris à l’avis suivant');
    await expectNoA11yViolations(container);
  });

  it('laisse le titre du décompte se couper quand le numéro est très long', async () => {
    const number = 'DC-2026-0001-REGULARISATION-ANNUELLE-DES-CHARGES-DE-COPROPRIETE-SANS-ESPACE';
    renderCharges(<StatementPage id={api.IDS.statement} />, routes({ ...api.statement, number }));
    const heading = await screen.findByRole('heading', { name: `Décompte ${number}` }, SLOW);
    expect(heading.className).toContain('[overflow-wrap:anywhere]');
  });

  it('télécharge le PDF d’un décompte émis', async () => {
    renderCharges(<StatementPage id={api.IDS.statement} />, routes(api.statement, { [`GET ${statementUrl('/pdf')}`]: { file: { type: 'application/pdf', content: '%PDF' } } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Télécharger le PDF' }, SLOW));
    await waitFor(() => { expect(vi.mocked(saveBlob)).toHaveBeenCalled(); }, SLOW);
    expect(vi.mocked(saveBlob).mock.calls.at(-1)?.[1]).toBe('decompte-DC-2026-0001.pdf');
  });

  it('un PDF indisponible (503) est expliqué sans bloquer l’écran', async () => {
    renderCharges(<StatementPage id={api.IDS.statement} />, routes(api.statement, { [`GET ${statementUrl('/pdf')}`]: { ...problem(503, 'charges_pdf_unavailable'), headers: { 'Retry-After': '30' } } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Télécharger le PDF' }, SLOW));
    expect(await screen.findByText(/PDF est momentanément indisponible/, {}, SLOW)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Décompte DC-2026-0001' })).toBeTruthy();
  });

  it('un décompte introuvable est dit introuvable', async () => {
    renderCharges(<StatementPage id={api.IDS.statement} />, { [`GET ${statementUrl()}`]: problem(404, 'charge_statement_not_found') });
    expect(await screen.findByText('Décompte introuvable', {}, SLOW)).toBeTruthy();
  });

  it('un aperçu non émis n’offre ni PDF, ni rectification, ni échéancier', async () => {
    renderCharges(<StatementPage id={api.IDS.statement} />, routes({ ...api.statement, status: 'computed', number: null, issued_at: null }), { role: 'admin' });
    await screen.findByRole('heading', { name: 'Décompte (aperçu)' }, SLOW);
    expect(screen.queryByRole('button', { name: /PDF|Rectifier|Étaler/ })).toBeNull();
  });
});

describe('décompte : échéancier et rectification', () => {
  const owing = { ...api.statement, balance: api.eur(30000), settlement: 'next_installments' };

  it('enregistre un échéancier avec fondement, motif et clé d’idempotence', async () => {
    const planUrl = statementUrl('/installment-plan');
    const { callsTo } = renderCharges(<StatementPage id={api.IDS.statement} />, routes(owing, { [`POST ${planUrl}`]: { body: { data: { ...owing, plan: { id: 'p', reason: 'x', recorded_at: '2026-11-16T10:00:00+00:00' } } } } }), { role: 'admin' });
    await userEvent.click(await screen.findByRole('button', { name: 'Étaler le solde' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer l’échéancier' }));
    expect(await within(dialog).findByText(/Indiquez un motif/)).toBeTruthy();
    expect(callsTo('POST', planUrl)).toHaveLength(0);

    await userEvent.type(within(dialog).getByRole('textbox', { name: /Motif/ }), 'Demande du locataire');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer l’échéancier' }));

    await waitFor(() => { expect(callsTo('POST', planUrl)).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', planUrl)[0]?.body).toEqual({ reason: 'Demande du locataire', basis: 'late_statement' });
    expect(callsTo('POST', planUrl)[0]?.headers.get('Idempotency-Key')).toMatch(/^ui-/);
  });

  it('un échéancier refusé (422) explique pourquoi', async () => {
    renderCharges(<StatementPage id={api.IDS.statement} />, routes(owing, { [`POST ${statementUrl('/installment-plan')}`]: problem(422, 'charges_plan_invalid') }), { role: 'admin' });
    await userEvent.click(await screen.findByRole('button', { name: 'Étaler le solde' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Motif/ }), 'Demande du locataire');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer l’échéancier' }));

    expect(await within(dialog).findByText('Échéancier non enregistré', {}, SLOW)).toBeTruthy();
  });

  it('un solde en faveur du locataire ne propose pas d’échéancier', async () => {
    renderCharges(<StatementPage id={api.IDS.statement} />, routes(), { role: 'admin' });
    await screen.findByRole('button', { name: 'Rectifier' }, SLOW);
    expect(screen.queryByRole('button', { name: 'Étaler le solde' })).toBeNull();
  });

  it('rectifie avec un motif et ouvre l’exercice rectificatif', async () => {
    const rectifyUrl = statementUrl('/rectify');
    const { callsTo, push } = renderCharges(<StatementPage id={api.IDS.statement} />, routes(api.statement, { [`POST ${rectifyUrl}`]: { status: 201, body: { data: { ...api.exerciseDetail, id: '01934f6e-0000-7000-8000-000000000199' } } } }), { role: 'admin' });
    await userEvent.click(await screen.findByRole('button', { name: 'Rectifier' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Motif/ }), 'Facture corrigée');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ouvrir la rectification' }));

    await waitFor(() => { expect(push).toHaveBeenCalledWith('/finances/charges/01934f6e-0000-7000-8000-000000000199'); }, SLOW);
    expect(callsTo('POST', rectifyUrl)[0]?.body).toEqual({ reason: 'Facture corrigée' });
  });

  it('le comptable ne rectifie pas et n’étale pas', async () => {
    renderCharges(<StatementPage id={api.IDS.statement} />, routes(owing), { role: 'accountant' });
    await screen.findByRole('heading', { name: 'Décompte DC-2026-0001' }, SLOW);
    expect(screen.queryByRole('button', { name: /Rectifier|Étaler/ })).toBeNull();
  });
});

describe('décompte : pièces partagées avec le locataire', () => {
  const fileUrl = statementUrl(`/files/${api.IDS.stmtFile}`);
  const shared = { ...api.statement, files: [{ ...api.statement.files[0], tenant_visible: true, visible_until: '2027-05-16' }] };

  it('prévient du risque de données de tiers avant de partager, puis publie', async () => {
    const { callsTo } = renderCharges(<StatementPage id={api.IDS.statement} />, routes(api.statement, { [`PATCH ${fileUrl}`]: { body: { data: shared } } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Partager' }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: 'Partager cette pièce avec le locataire ?' });
    expect(within(dialog).getByText(/informations sur d’autres occupants/)).toBeTruthy();
    expect(callsTo('PATCH', fileUrl)).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Partager la pièce' }));

    await waitFor(() => { expect(callsTo('PATCH', fileUrl)).toHaveLength(1); }, SLOW);
    expect(callsTo('PATCH', fileUrl)[0]?.body).toEqual({ tenant_visible: true });
  });

  it('affiche la date de fin de visibilité et retire l’accès', async () => {
    const { callsTo } = renderCharges(<StatementPage id={api.IDS.statement} />, routes(shared, { [`PATCH ${fileUrl}`]: { body: { data: api.statement } } }));
    expect(await screen.findByText(/Visible par le locataire jusqu’au 16\/05\/2027/, {}, SLOW)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Retirer l’accès' }));

    await waitFor(() => { expect(callsTo('PATCH', fileUrl)).toHaveLength(1); }, SLOW);
    expect(callsTo('PATCH', fileUrl)[0]?.body).toEqual({ tenant_visible: false });
  });

  it('un refus du serveur (403) est affiché dans la confirmation', async () => {
    renderCharges(<StatementPage id={api.IDS.statement} />, routes(api.statement, { [`PATCH ${fileUrl}`]: problem(403, 'charges_role_forbidden') }));
    await userEvent.click(await screen.findByRole('button', { name: 'Partager' }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: 'Partager cette pièce avec le locataire ?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Partager la pièce' }));

    expect(await within(dialog).findByText(/Votre rôle ne permet pas/, {}, SLOW)).toBeTruthy();
  });
});

describe('décompte : états particuliers', () => {
  it('signale un décompte remplacé', async () => {
    renderCharges(<StatementPage id={api.IDS.statement} />, routes({ ...api.statement, status: 'superseded' }));
    expect(await screen.findByText('Décompte remplacé', {}, SLOW)).toBeTruthy();
  });

  it('un décompte en échec propose de reprendre l’émission', async () => {
    const retryUrl = statementUrl('/retry');
    const { callsTo } = renderCharges(<StatementPage id={api.IDS.statement} />, routes({ ...api.statement, status: 'failed', failure_reason: 'charges_pdf_unavailable' }, { [`POST ${retryUrl}`]: { body: { data: api.statement } } }), { role: 'admin' });
    expect(await screen.findByText(/service de PDF était indisponible/, {}, SLOW)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Reprendre l’émission' }));
    await waitFor(() => { expect(callsTo('POST', retryUrl)).toHaveLength(1); }, SLOW);
  });
});
