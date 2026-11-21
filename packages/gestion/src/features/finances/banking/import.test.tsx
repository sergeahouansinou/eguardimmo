import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import * as api from './api/responses.fixtures';
import { ImportPage } from './ImportPage';
import { bankingUrl, problem, renderBanking } from './testing';

const SLOW = { timeout: 4000 };
const previewUrl = bankingUrl(`/accounts/${api.IDS.account}/statements/preview`);
const importUrl = bankingUrl(`/accounts/${api.IDS.account}/statements`);
const search = `compte=${api.IDS.account}`;

const csvFile = () => new File(['date;libelle;montant\n05/03/2026;VIR LOYER;850,00'], 'mars.csv', { type: 'text/csv' });

async function chooseFile(file: File) {
  await userEvent.upload(await screen.findByLabelText(/^Fichier du relevé/, {}, SLOW), file);
}

describe('import d’un relevé', () => {
  it('refuse le gestionnaire sans appeler la banque', async () => {
    const { calls } = renderBanking(<ImportPage />, {}, { role: 'manager' });
    expect(await screen.findByText('Banque indisponible pour ce compte', {}, SLOW)).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('montre l’aperçu puis importe avec une clé d’idempotence et affiche les lignes refusées', async () => {
    const { container, callsTo } = renderBanking(<ImportPage />, {
      [`POST ${previewUrl}`]: { body: { data: api.preview } },
      [`POST ${importUrl}`]: { status: 201, body: { data: { ...api.statement, lines_total: 3, lines_imported: 2, lines_rejected: 1 }, meta: { rejected: [{ line: 3, code: 'date_invalid' }] } } },
    }, { search });
    await chooseFile(csvFile());
    await userEvent.click(screen.getByRole('button', { name: 'Voir l’aperçu' }));

    expect(await screen.findByRole('region', { name: 'Aperçu du relevé' }, SLOW)).toBeTruthy();
    expect(norm(document.body.textContent)).toContain('Ligne 3 : date illisible');
    expect(callsTo('POST', importUrl)).toHaveLength(0);
    await expectNoA11yViolations(container);

    await userEvent.click(screen.getByRole('button', { name: 'Importer 2 lignes' }));
    expect(await screen.findByText('Relevé importé', {}, SLOW)).toBeTruthy();
    expect(norm(document.body.textContent)).toContain('2 lignes importées, 0 doublon ignoré, 1 refusée');
    expect(norm(document.body.textContent)).toContain('Ligne 3 : date illisible');
    const call = callsTo('POST', importUrl)[0];
    expect(call?.headers.get('Idempotency-Key')).toMatch(/^ui-/);
    expect(call?.form).toMatchObject({ format: 'csv', file: expect.stringContaining('file:mars.csv') as string });
    expect(screen.getByRole('link', { name: 'Pointer les lignes' }).getAttribute('href')).toBe(`/finances/banque?compte=${api.IDS.account}&calcul=1`);
  });

  it('prévient quand le relevé est déjà importé', async () => {
    renderBanking(<ImportPage />, { [`POST ${previewUrl}`]: { body: { data: { ...api.preview, already_imported: true, would_import: 0, would_duplicate: 3 } } } }, { search });
    await chooseFile(csvFile());
    await userEvent.click(screen.getByRole('button', { name: 'Voir l’aperçu' }));
    expect(await screen.findByText('Relevé déjà importé', {}, SLOW)).toBeTruthy();
  });

  it('choisit camt.053 depuis l’extension et traduit le 503 XSD indisponible', async () => {
    const { callsTo } = renderBanking(<ImportPage />, { [`POST ${previewUrl}`]: problem(503, 'banking_xsd_unavailable') }, { search });
    await chooseFile(new File(['<Document/>'], 'releve.xml', { type: 'text/xml' }));
    await userEvent.click(screen.getByRole('button', { name: 'Voir l’aperçu' }));
    expect(await screen.findByText(/schémas officiels ne sont pas installés/, {}, SLOW)).toBeTruthy();
    expect(callsTo('POST', previewUrl)[0]?.form).toMatchObject({ format: 'camt053' });
    expect(Object.keys(callsTo('POST', previewUrl)[0]?.form ?? {}).some((key) => key.startsWith('csv_profile'))).toBe(false);
  });

  it('refuse un fichier trop volumineux sans appel', async () => {
    const { callsTo } = renderBanking(<ImportPage />, {}, { search });
    await chooseFile(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'gros.csv', { type: 'text/csv' }));
    expect(await screen.findByText('Fichier trop volumineux : 10 Mo au maximum.', {}, SLOW)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Voir l’aperçu' }));
    expect(screen.getByText('Fichier trop volumineux : 10 Mo au maximum.')).toBeTruthy();
    expect(callsTo('POST', previewUrl)).toHaveLength(0);
  });

  it('exige un compte', async () => {
    renderBanking(<ImportPage />, {});
    await chooseFile(csvFile());
    await userEvent.click(screen.getByRole('button', { name: 'Voir l’aperçu' }));
    expect(await screen.findByText('Choisissez le compte du relevé.', {}, SLOW)).toBeTruthy();
  });

  it.each([
    ['422 relevé invalide', problem(422, 'bank_statement_invalid', 'Colonne montant absente'), /Colonne montant absente/],
    ['409 compte différent', problem(422, 'bank_statement_account_mismatch'), /compte du relevé/],
    ['429', problem(429, 'throttled'), /Trop de requêtes/],
    ['403 2FA absente', problem(403, 'two_factor_required'), /double authentification/],
  ])('traduit l’erreur d’import %s', async (_name, reply, expected) => {
    renderBanking(<ImportPage />, { [`POST ${previewUrl}`]: reply }, { search });
    await chooseFile(csvFile());
    await userEvent.click(screen.getByRole('button', { name: 'Voir l’aperçu' }));
    expect(await screen.findByText(expected, {}, SLOW)).toBeTruthy();
  });

  it('propose d’ajouter un compte quand aucun n’est actif', async () => {
    renderBanking(<ImportPage />, { [`GET ${bankingUrl('/accounts')}`]: { body: { data: [api.accountClosed] } } });
    expect(await screen.findByText('Aucun compte actif', {}, SLOW)).toBeTruthy();
    expect(await screen.findByRole('link', { name: 'Ouvrir les comptes bancaires' }, SLOW)).toBeTruthy();
  });
});
