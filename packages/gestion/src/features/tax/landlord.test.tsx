import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { saveBlob } from '../finances/rent/download';
import { LandlordTaxPage } from './LandlordTaxPage';
import { TaxDetailPage } from './TaxPage';
import * as api from './api/fixtures';
import { problem, renderTax, taxUrl } from './testing';

vi.mock('../finances/rent/download', () => ({ saveBlob: vi.fn(), safeFilename: (name: string) => name }));

const SLOW = { timeout: 4000 };
const income = `GET ${taxUrl('/rental-income/2025')}`;
const list = `GET ${taxUrl('/summaries')}`;
const base = { [income]: { body: { data: api.income } }, [list]: { body: api.page([api.summaryListRow]) } };

describe('fiscalité du bailleur autonome (2044, revenus 2025)', () => {
  it('affiche l’avertissement du serveur, les lignes, les deux bases sans verdict et les synthèses figées', async () => {
    const { container } = renderTax(<LandlordTaxPage />, base);
    expect(await screen.findByText(api.income.warning, {}, SLOW)).toBeTruthy();
    expect(screen.getByText(/à faire valider par un expert-comptable/)).toBeTruthy();
    expect(screen.getByText('Résidence des Lilas')).toBeTruthy();
    expect(screen.getByText(/Propriété partagée : 50 % \(Pleine propriété\), 50 % \(Pleine propriété\)/)).toBeTruthy();
    expect(screen.getByText('Ce bien est détenu à plusieurs : vérifiez les quotes-parts avant de déclarer.')).toBeTruthy();
    const micro = screen.getByRole('region', { name: /Micro-foncier/ });
    expect(micro.textContent).toContain('30 %');
    expect(screen.getByRole('region', { name: /Régime réel/ }).textContent).toMatch(/4\s100\s€/);
    expect(screen.getByText(/sans recommandation de régime/)).toBeTruthy();
    expect(screen.getByText(/déficit foncier n’est pas simulé/)).toBeTruthy();
    expect(await screen.findByRole('region', { name: 'Synthèses figées' }, SLOW)).toBeTruthy();
    expect(screen.queryByText('PROVISOIRE')).toBeNull();
    await expectNoA11yViolations(container);
  });

  it('montre le montant arrondi en euros entiers et n’invente aucun calcul', async () => {
    renderTax(<LandlordTaxPage />, base);
    const region = await screen.findByRole('region', { name: 'Lignes du bien Résidence des Lilas, défilement horizontal' }, SLOW);
    expect(region.textContent).toMatch(/12\s000\s€/);
    expect(region.textContent).not.toContain('12 000,37');
  });

  it('marque un calcul provisoire et interdit de figer', async () => {
    renderTax(<LandlordTaxPage />, { ...base, [income]: { body: { data: api.incomeProvisional } } });
    expect(await screen.findByText('Calcul provisoire', {}, SLOW)).toBeTruthy();
    expect(screen.getByText('PROVISOIRE').getAttribute('aria-hidden') ?? screen.getByText('PROVISOIRE').parentElement?.getAttribute('aria-hidden')).toBe('true');
    expect((screen.getByRole('button', { name: /Figer la synthèse 2025/ })).hasAttribute('disabled')).toBe(true);
  });

  it('interdit de figer quand un prêt a deux sources d’intérêts', async () => {
    renderTax(<LandlordTaxPage />, { ...base, [income]: { body: { data: api.incomeWithBlocker } } });
    expect(await screen.findByText('Points à corriger avant de figer', {}, SLOW)).toBeTruthy();
    expect(screen.getByText(/gardez une seule source/)).toBeTruthy();
    expect((screen.getByRole('button', { name: /Figer la synthèse 2025/ })).hasAttribute('disabled')).toBe(true);
  });

  it('simule le déficit seulement si le foyer est complet', async () => {
    const { calls } = renderTax(<LandlordTaxPage />, { ...base, [income]: (call) => ({ body: { data: call.search.get('household_complete') === '1' ? api.incomeWithDeficit : api.income } }) });
    await screen.findByText(/déficit foncier n’est pas simulé/, {}, SLOW);
    await userEvent.click(screen.getByLabelText(/foyer fiscal est entièrement suivi/));
    expect(await screen.findByText('Simulation du déficit foncier', {}, SLOW)).toBeTruthy();
    expect(calls.some((call) => call.search.get('household_complete') === '1')).toBe(true);
  });

  it('fige la synthèse après confirmation avec une clé d’idempotence', async () => {
    const { callsTo, push } = renderTax(<LandlordTaxPage />, { ...base, [`POST ${taxUrl('/summaries')}`]: { status: 201, body: { data: api.summaryDetail } } });
    await userEvent.click(await screen.findByRole('button', { name: /Figer la synthèse 2025/ }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Figer la synthèse' }));
    await waitFor(() => { expect(callsTo('POST', taxUrl('/summaries'))).toHaveLength(1); }, SLOW);
    const call = callsTo('POST', taxUrl('/summaries'))[0];
    expect(call?.body).toEqual({ income_year: 2025, household_complete: false });
    expect(call?.headers.get('Idempotency-Key')).toMatch(/^ui-/);
    await waitFor(() => { expect(push).toHaveBeenCalledWith(`/finances/fiscalite/${api.IDS.summary}`); }, SLOW);
  });

  it('affiche le refus tax_period_not_closed (409) dans la confirmation', async () => {
    renderTax(<LandlordTaxPage />, { ...base, [`POST ${taxUrl('/summaries')}`]: problem(409, 'tax_period_not_closed') });
    await userEvent.click(await screen.findByRole('button', { name: /Figer la synthèse 2025/ }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Figer la synthèse' }));
    expect(await within(dialog).findByText(/clôturée/, {}, SLOW)).toBeTruthy();
  });

  it('masque Figer pour un rôle sans droit de préparation', async () => {
    renderTax(<LandlordTaxPage />, base, { role: 'manager' });
    await screen.findByText(api.income.warning, {}, SLOW);
    expect(screen.queryByRole('button', { name: /Figer la synthèse/ })).toBeNull();
  });

  it('gère 422 tax_year_unsupported et 429 avec Réessayer', async () => {
    renderTax(<LandlordTaxPage />, { ...base, [income]: problem(422, 'tax_year_unsupported') });
    expect(await screen.findByText(/Seule la déclaration des revenus 2025/, {}, SLOW)).toBeTruthy();
  });

  it('gère la limite de débit 429 du calcul', async () => {
    renderTax(<LandlordTaxPage />, { ...base, [income]: problem(429, 'too_many_requests') });
    expect(await screen.findByText(/Trop de requêtes/, {}, SLOW)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Réessayer' }).length).toBeGreaterThan(0);
  });

  it('affiche l’accès refusé 403 pour une agence côté serveur', async () => {
    renderTax(<LandlordTaxPage />, { ...base, [income]: problem(403, 'tax_landlord_only') });
    expect(await screen.findByText('Accès refusé', {}, SLOW)).toBeTruthy();
  });

  describe('détail d’une synthèse figée', () => {
    const show = `GET ${taxUrl(`/summaries/${api.IDS.summary}`)}`;

    it('affiche la synthèse, le PDF et le CSV passent par le flux authentifié', async () => {
      const { callsTo } = renderTax(<TaxDetailPage id={api.IDS.summary} />, {
        [show]: { body: { data: api.summaryDetail } },
        [`GET ${taxUrl(`/summaries/${api.IDS.summary}/pdf`)}`]: { file: { type: 'application/pdf', content: '%PDF' } },
      });
      expect(await screen.findByRole('heading', { level: 1, name: 'Synthèse fiscale 2025' }, SLOW)).toBeTruthy();
      expect(screen.getByText('Figée')).toBeTruthy();
      await userEvent.click(await screen.findByRole('button', { name: 'Télécharger le PDF' }, SLOW));
      await waitFor(() => { expect(callsTo('GET', taxUrl(`/summaries/${api.IDS.summary}/pdf`))).toHaveLength(1); }, SLOW);
      await waitFor(() => { expect(saveBlob).toHaveBeenCalled(); }, SLOW);
    });

    it('rectifie avec un motif : version lue, clé d’idempotence, navigation vers la nouvelle version', async () => {
      const { callsTo, push } = renderTax(<TaxDetailPage id={api.IDS.summary} />, {
        [show]: { body: { data: api.summaryDetail } },
        [`POST ${taxUrl(`/summaries/${api.IDS.summary}/rectify`)}`]: { status: 201, body: { data: { ...api.summaryDetail, id: api.IDS.summaryTwo } } },
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Rectifier' }, SLOW));
      const dialog = await screen.findByRole('dialog');
      await userEvent.type(within(dialog).getByLabelText(/Motif/), 'Facture ajoutée');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Rectifier' }));
      await waitFor(() => { expect(callsTo('POST', taxUrl(`/summaries/${api.IDS.summary}/rectify`))).toHaveLength(1); }, SLOW);
      const call = callsTo('POST', taxUrl(`/summaries/${api.IDS.summary}/rectify`))[0];
      expect(call?.body).toEqual({ reason: 'Facture ajoutée', lock_version: 1 });
      expect(call?.headers.get('Idempotency-Key')).toMatch(/^ui-/);
      await waitFor(() => { expect(push).toHaveBeenCalledWith(`/finances/fiscalite/${api.IDS.summaryTwo}`); }, SLOW);
    });

    it('refuse un motif trop court sans appeler le serveur', async () => {
      const { callsTo } = renderTax(<TaxDetailPage id={api.IDS.summary} />, { [show]: { body: { data: api.summaryDetail } } });
      await userEvent.click(await screen.findByRole('button', { name: 'Rectifier' }, SLOW));
      const dialog = await screen.findByRole('dialog');
      await userEvent.type(within(dialog).getByLabelText(/Motif/), 'abc');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Rectifier' }));
      expect(await within(dialog).findByText(/au moins 5 caractères/, {}, SLOW)).toBeTruthy();
      expect(callsTo('POST', taxUrl(`/summaries/${api.IDS.summary}/rectify`))).toHaveLength(0);
    });

    it('409 tax_summary_stale_version : message de rechargement et relecture', async () => {
      const { callsTo } = renderTax(<TaxDetailPage id={api.IDS.summary} />, {
        [show]: { body: { data: api.summaryDetail } },
        [`POST ${taxUrl(`/summaries/${api.IDS.summary}/rectify`)}`]: problem(409, 'tax_summary_stale_version'),
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Rectifier' }, SLOW));
      const dialog = await screen.findByRole('dialog');
      await userEvent.type(within(dialog).getByLabelText(/Motif/), 'Facture ajoutée');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Rectifier' }));
      expect(await within(dialog).findByText(/modifiée depuis votre lecture/, {}, SLOW)).toBeTruthy();
      await waitFor(() => { expect(callsTo('GET', taxUrl(`/summaries/${api.IDS.summary}`)).length).toBeGreaterThan(1); }, SLOW);
    });

    it('n’offre ni rectification ni publication sur une synthèse remplacée', async () => {
      renderTax(<TaxDetailPage id={api.IDS.summary} />, { [show]: { body: { data: { ...api.summaryDetail, status: 'superseded' } } } });
      expect(await screen.findByText('Synthèse remplacée', {}, SLOW)).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Rectifier' })).toBeNull();
    });

    it('affiche 404 sans erreur technique', async () => {
      renderTax(<TaxDetailPage id={api.IDS.summary} />, { [show]: problem(404, 'tax_summary_not_found') });
      expect(await screen.findByText('Synthèse introuvable', {}, SLOW)).toBeTruthy();
    });

    it('affiche l’indisponibilité du PDF (503) sans fermer la page', async () => {
      renderTax(<TaxDetailPage id={api.IDS.summary} />, { [show]: { body: { data: api.summaryDetail } }, [`GET ${taxUrl(`/summaries/${api.IDS.summary}/pdf`)}`]: problem(503, 'tax_pdf_unavailable') });
      await userEvent.click(await screen.findByRole('button', { name: 'Télécharger le PDF' }, SLOW));
      expect(await screen.findByText(/PDF n’est pas disponible/, {}, SLOW)).toBeTruthy();
    });
  });
});
