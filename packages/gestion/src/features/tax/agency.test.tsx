import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { orgPath } from '../orgapi/testing';
import { TaxDetailPage, TaxPage } from './TaxPage';
import * as api from './api/fixtures';
import { problem, renderTax, taxUrl } from './testing';

vi.mock('../finances/rent/download', () => ({ saveBlob: vi.fn(), safeFilename: (name: string) => name }));

const SLOW = { timeout: 4000 };
const list = `GET ${taxUrl('/mandant-statements')}`;
const mandants = `GET ${orgPath(api.IDS.org, '/mandates/mandants')}`;
const base = { [list]: { body: api.page([api.statementListRow]) }, [mandants]: { body: api.mandants } };
const agency = { kind: 'agency' as const };

describe('relevés fiscaux des mandants (agence)', () => {
  it('liste les relevés avec le nom du mandant, sans appeler les routes du bailleur', async () => {
    const { container, calls } = renderTax(<TaxPage />, base, agency);
    const table = await screen.findByRole('table', {}, SLOW);
    await waitFor(() => { expect(table.textContent).toContain('Entreprise Dubois'); }, SLOW);
    expect(table.textContent).toMatch(/4\s100\s€/);
    expect(calls.some((call) => call.path.includes('/tax/summaries') || call.path.includes('rental-income'))).toBe(false);
    await expectNoA11yViolations(container);
  });

  it('filtre par mandant', async () => {
    const { calls } = renderTax(<TaxPage />, base, agency);
    await userEvent.click(await screen.findByRole('combobox', { name: /Mandant/ }, SLOW));
    await userEvent.click(await screen.findByRole('option', { name: 'Famille Kouassi' }));
    await waitFor(() => { expect(calls.some((call) => call.search.get('mandant') === api.IDS.mandantTwo)).toBe(true); }, SLOW);
  });

  it('propose l’état vide', async () => {
    renderTax(<TaxPage />, { ...base, [list]: { body: api.page([]) } }, agency);
    expect(await screen.findByText('Aucun relevé généré', {}, SLOW)).toBeTruthy();
  });

  it('génère des relevés : sélection, clé d’idempotence, résultat par mandant avec échec explicite', async () => {
    const { callsTo } = renderTax(<TaxPage />, { ...base, [`POST ${taxUrl('/mandant-statements')}`]: { status: 201, body: api.generation } }, agency);
    await userEvent.click(await screen.findByRole('button', { name: 'Générer les relevés' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(await within(dialog).findByLabelText('Entreprise Dubois', {}, SLOW));
    await userEvent.click(within(dialog).getByLabelText('Famille Kouassi'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Générer 2 relevés' }));
    expect(await within(dialog).findByText('Généré', {}, SLOW)).toBeTruthy();
    expect(within(dialog).getByText('Une période comptable de l’année n’est pas clôturée.')).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: 'Ouvrir le relevé' }).getAttribute('href')).toBe(`/finances/fiscalite/${api.IDS.statement}`);
    const call = callsTo('POST', taxUrl('/mandant-statements'))[0];
    expect(call?.body).toEqual({ income_year: 2025, mandant_ids: [api.IDS.mandant, api.IDS.mandantTwo] });
    expect(call?.headers.get('Idempotency-Key')).toMatch(/^ui-/);
  });

  it('découpe la génération en lots de 10 mandants, affiche la progression et relance un échec avec la clé du lot', async () => {
    const many = Array.from({ length: 12 }, (_, index) => ({ party_id: `0198a0a0-0000-7000-8000-0000000001${String(index).padStart(2, '0')}`, display_name: `Mandant ${String(index + 1)}` }));
    let calls503 = 0;
    const { callsTo } = renderTax(<TaxPage />, {
      ...base,
      [mandants]: { body: { data: many } },
      [`POST ${taxUrl('/mandant-statements')}`]: (call) => {
        const ids = (call.body as { mandant_ids: string[] }).mandant_ids;
        calls503 += 1;
        return {
          status: 201,
          body: {
            data: ids.map((id, index) => (calls503 === 1 && index === 0
              ? { mandant_id: id, outcome: 'failed', statement: null, error: { code: 'tax_batch_time_exceeded', status: 503, detail: 'Délai dépassé pour ce mandant.' } }
              : { mandant_id: id, outcome: 'created', statement: { ...api.statementListRow, id: `0198e000-0000-7000-8000-00000000${String(calls503)}${String(index).padStart(3, '0')}` }, error: null })),
          },
        };
      },
    }, agency);
    await userEvent.click(await screen.findByRole('button', { name: 'Générer les relevés' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    for (const mandant of many) await userEvent.click(await within(dialog).findByLabelText(mandant.display_name, {}, SLOW));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Générer 12 relevés' }));
    await waitFor(() => { expect(callsTo('POST', taxUrl('/mandant-statements'))).toHaveLength(2); }, SLOW);
    const sizes = callsTo('POST', taxUrl('/mandant-statements')).map((call) => (call.body as { mandant_ids: string[] }).mandant_ids.length);
    expect(sizes).toEqual([10, 2]);
    expect(await within(dialog).findByText('Délai dépassé pour ce mandant.', {}, SLOW)).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: /Réessayer les/ })).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => { expect(callsTo('POST', taxUrl('/mandant-statements'))).toHaveLength(3); }, SLOW);
    await waitFor(() => { expect(within(dialog).queryByText('Délai dépassé pour ce mandant.')).toBeNull(); }, SLOW);
  });

  it('relance tous les échecs d’un coup quand il y en a plusieurs', async () => {
    const failed = (id: string) => ({ mandant_id: id, outcome: 'failed', statement: null, error: { code: 'tax_period_not_closed', status: 409, detail: 'Période non clôturée.' } });
    const { callsTo } = renderTax(<TaxPage />, {
      ...base,
      [`POST ${taxUrl('/mandant-statements')}`]: (call) => ({ status: 201, body: { data: (call.body as { mandant_ids: string[] }).mandant_ids.map(failed) } }),
    }, agency);
    await userEvent.click(await screen.findByRole('button', { name: 'Générer les relevés' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(await within(dialog).findByLabelText('Entreprise Dubois', {}, SLOW));
    await userEvent.click(within(dialog).getByLabelText('Famille Kouassi'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Générer 2 relevés' }));
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Réessayer les 2 échecs' }, SLOW));
    await waitFor(() => { expect(callsTo('POST', taxUrl('/mandant-statements'))).toHaveLength(2); }, SLOW);
    expect((callsTo('POST', taxUrl('/mandant-statements'))[1]?.body as { mandant_ids: string[] }).mandant_ids).toHaveLength(2);
  });

  it('refuse une génération sans mandant sans appeler le serveur', async () => {
    const { callsTo } = renderTax(<TaxPage />, base, agency);
    await userEvent.click(await screen.findByRole('button', { name: 'Générer les relevés' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Générer 0 relevé' }, SLOW));
    expect(await within(dialog).findByText('Choisissez au moins un mandant.', {}, SLOW)).toBeTruthy();
    expect(callsTo('POST', taxUrl('/mandant-statements'))).toHaveLength(0);
  });

  it('masque la génération pour un rôle sans droit de préparation', async () => {
    renderTax(<TaxPage />, base, { ...agency, role: 'manager' });
    await screen.findByRole('table', {}, SLOW);
    expect(screen.queryByRole('button', { name: 'Générer les relevés' })).toBeNull();
  });

  it('gère 403 tax_agency_only et 429', async () => {
    renderTax(<TaxPage />, { ...base, [list]: problem(403, 'tax_agency_only') }, agency);
    expect(await screen.findByText('Accès refusé', {}, SLOW)).toBeTruthy();
  });

  it('gère la limite de débit 429 avec Réessayer', async () => {
    renderTax(<TaxPage />, { ...base, [list]: problem(429, 'too_many_requests') }, agency);
    expect(await screen.findByText(/Trop de requêtes/, {}, SLOW)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  describe('détail d’un relevé', () => {
    const show = `GET ${taxUrl(`/mandant-statements/${api.IDS.statement}`)}`;
    const publish = `POST ${taxUrl(`/mandant-statements/${api.IDS.statement}/publish`)}`;

    it('publie après confirmation, avec la version lue', async () => {
      const { callsTo } = renderTax(<TaxDetailPage id={api.IDS.statement} />, { [show]: { body: { data: api.statementDetail } }, [publish]: { body: { data: { ...api.statementDetail, status: 'published' } } } }, agency);
      expect(await screen.findByRole('heading', { level: 1, name: 'Relevé fiscal 2025' }, SLOW)).toBeTruthy();
      await userEvent.click(await screen.findByRole('button', { name: 'Publier au mandant' }, SLOW));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText(/ne se retire pas/)).toBeTruthy();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Publier' }));
      await waitFor(() => { expect(callsTo('POST', taxUrl(`/mandant-statements/${api.IDS.statement}/publish`))).toHaveLength(1); }, SLOW);
      expect(callsTo('POST', taxUrl(`/mandant-statements/${api.IDS.statement}/publish`))[0]?.body).toEqual({ lock_version: 1 });
    });

    it('demande la double authentification quand le serveur l’exige, puis réessaie', async () => {
      let count = 0;
      const { callsTo } = renderTax(<TaxDetailPage id={api.IDS.statement} />, {
        [show]: { body: { data: api.statementDetail } },
        [publish]: () => {
          count += 1;
          return count === 1 ? problem(403, 'reauthentication_required') : { body: { data: { ...api.statementDetail, status: 'published' } } };
        },
      }, agency);
      await userEvent.click(await screen.findByRole('button', { name: 'Publier au mandant' }, SLOW));
      const dialog = await screen.findByRole('dialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Publier' }));
      const proofDialog = await screen.findByRole('dialog', { name: 'Confirmez votre identité' }, SLOW);
      await userEvent.type(within(proofDialog).getByLabelText(/Code de double authentification/), '123456');
      await userEvent.click(within(proofDialog).getByRole('button', { name: 'Confirmer' }));
      await waitFor(() => { expect(callsTo('POST', taxUrl(`/mandant-statements/${api.IDS.statement}/publish`))).toHaveLength(2); }, SLOW);
    });

    it('n’offre pas la publication d’un relevé déjà publié', async () => {
      renderTax(<TaxDetailPage id={api.IDS.statement} />, { [show]: { body: { data: { ...api.statementDetail, status: 'published', published_at: '2026-03-12T10:00:00+00:00' } } } }, agency);
      await screen.findByText('Publiée', {}, SLOW);
      expect(screen.queryByRole('button', { name: 'Publier au mandant' })).toBeNull();
    });

    it('409 tax_summary_not_publishable : explique le refus', async () => {
      renderTax(<TaxDetailPage id={api.IDS.statement} />, { [show]: { body: { data: api.statementDetail } }, [publish]: problem(409, 'tax_summary_not_publishable') }, agency);
      await userEvent.click(await screen.findByRole('button', { name: 'Publier au mandant' }, SLOW));
      const dialog = await screen.findByRole('dialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Publier' }));
      expect(await within(dialog).findByText(/ne peut plus être publié/, {}, SLOW)).toBeTruthy();
    });
  });
});
