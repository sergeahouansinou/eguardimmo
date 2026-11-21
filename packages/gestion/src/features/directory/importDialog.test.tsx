import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { FIXTURE_IMPORT, FIXTURE_OTHER_PARTY, FIXTURE_PARTY } from './api/fixtures';
import { ImportDialog } from './ImportDialog';
import { dirUrl, problem, renderDirectory } from './testing';

const SLOW = { timeout: 4000 };
const route = `POST ${dirUrl('/parties/import')}`;
const csv = 'Type;Nom;Société;E-mail;Interlocuteur\nPersonne;Dubois;;camille@exemple.fr;\nSociété;;Plomberie Sanvi;contact@plomberie-sanvi.fr;Rodrigue\nPersonne;Martin;;pas-un-mail;\n';
const file = (content = csv, name = 'contacts.csv') => new File([content], name, { type: 'text/csv' });

async function upload(content?: string, name?: string) {
  const input = await screen.findByLabelText('Fichier CSV', {}, SLOW);
  await userEvent.upload(input, file(content, name));
}

const mount = (routes: Parameters<typeof renderDirectory>[1], onClose = () => undefined) => renderDirectory(<ImportDialog open onClose={onClose} />, routes);
const importButton = () => screen.findByRole('button', { name: /^Importer \d+ contact/ }, SLOW);

describe('import CSV', () => {
  it('résume le fichier, écarte les lignes invalides et envoie les lignes valides avec un client_id', async () => {
    let closed = false;
    const { callsTo } = mount({ [route]: { status: 201, body: { data: { id: FIXTURE_IMPORT, count: 2, party_ids: [FIXTURE_PARTY, FIXTURE_OTHER_PARTY] } } } }, () => { closed = true; });
    expect(await screen.findByRole('dialog', {}, SLOW)).toBeTruthy();
    await expectNoA11yViolations(document.body);
    await upload();
    expect(await screen.findByText('2 lignes prêtes à importer.', {}, SLOW)).toBeTruthy();
    expect(screen.getByText(/1 ligne écartée : elles ne seront pas importées/)).toBeTruthy();
    expect(screen.getByText('Ligne 4 : E-mail invalide.')).toBeTruthy();
    await userEvent.click(await importButton());
    await waitFor(() => { expect(closed).toBe(true); }, SLOW);
    const body = callsTo('POST', dirUrl('/parties/import'))[0]?.body as { client_id: string; allow_duplicates: boolean; rows: unknown[] };
    expect(body.client_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.allow_duplicates).toBe(false);
    expect(body.rows).toEqual([
      { kind: 'person', last_name: 'Dubois', contact_points: [{ type: 'email', value: 'camille@exemple.fr', label: null, primary: true }] },
      { kind: 'company', company_name: 'Plomberie Sanvi', contact_points: [{ type: 'email', value: 'contact@plomberie-sanvi.fr', label: 'Rodrigue', primary: true }] },
    ]);
  });

  it('rejette un fichier qui n’est pas un CSV, sans lecture ni envoi', async () => {
    const { calls } = mount({});
    await upload('x', 'contacts.pdf');
    expect(await screen.findByText('Ce fichier n’est pas un CSV.', {}, SLOW)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Importer' }).hasAttribute('disabled')).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('signale un fichier inutilisable', async () => {
    mount({});
    await upload('E-mail\na@b.fr');
    expect(await screen.findByText(/colonne « Nom » ou « Société » est obligatoire/, {}, SLOW)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Importer' }).hasAttribute('disabled')).toBe(true);
  });

  it('affiche les lignes refusées par le serveur avec le numéro de ligne du fichier', async () => {
    mount({
      [route]: { status: 422, body: { type: 'about:blank', title: 'x', status: 422, code: 'party_import_invalid', detail: 'x', rows: [{ row: 2, errors: { 'contact_points.0.value': ['Valeur invalide.'] } }], rows_in_error: 1 } },
    });
    await upload();
    await userEvent.click(await importButton());
    expect(await screen.findByText('Aucun contact n’a été importé', {}, SLOW)).toBeTruthy();
    expect(screen.getByText('Ligne 3 : Valeur invalide.')).toBeTruthy();
  });

  it('propose d’importer malgré des doublons, avec un nouveau client_id et allow_duplicates', async () => {
    let calls = 0;
    const { callsTo } = mount({
      [route]: () => {
        calls += 1;
        return calls === 1
          ? { status: 409, body: { type: 'about:blank', title: 'x', status: 409, code: 'party_possible_duplicate', detail: 'x', rows: [{ row: 1, candidates: [{ id: FIXTURE_OTHER_PARTY, display_name: 'Camille Dubois', reasons: ['email'] }], duplicate_of_rows: [] }, { row: 2, candidates: [], duplicate_of_rows: [1] }], rows_in_error: 2 } }
          : { status: 201, body: { data: { id: FIXTURE_IMPORT, count: 2, party_ids: [FIXTURE_PARTY, FIXTURE_OTHER_PARTY] } } };
      },
    });
    await upload();
    await userEvent.click(await importButton());
    expect(await screen.findByText(/Des doublons possibles ont été trouvés/, {}, SLOW)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Camille Dubois' }).getAttribute('href')).toBe(`/contacts/${FIXTURE_OTHER_PARTY}`);
    expect(screen.getByText(/même contact que la ligne 2 du fichier/)).toBeTruthy();
    await userEvent.click(screen.getByRole('checkbox', { name: /Importer quand même/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Importer \d+ contact/ }));
    await waitFor(() => { expect(callsTo('POST', dirUrl('/parties/import'))).toHaveLength(2); }, SLOW);
    const [first, second] = callsTo('POST', dirUrl('/parties/import')).map((call) => call.body as { client_id: string; allow_duplicates: boolean });
    expect(first?.allow_duplicates).toBe(false);
    expect(second?.allow_duplicates).toBe(true);
    expect(second?.client_id).not.toBe(first?.client_id);
  });

  it('un nouvel essai identique rejoue le même client_id', async () => {
    let calls = 0;
    const { callsTo } = mount({ [route]: () => { calls += 1; return calls === 1 ? problem(503, 'service_unavailable') : { status: 200, body: { data: { id: FIXTURE_IMPORT, count: 2, party_ids: [FIXTURE_PARTY, FIXTURE_OTHER_PARTY] } } }; } });
    await upload();
    await userEvent.click(await importButton());
    expect(await screen.findByText('Import refusé', {}, SLOW)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /^Importer \d+ contact/ }));
    await waitFor(() => { expect(callsTo('POST', dirUrl('/parties/import'))).toHaveLength(2); }, SLOW);
    const ids = callsTo('POST', dirUrl('/parties/import')).map((call) => (call.body as { client_id: string }).client_id);
    expect(ids[0]).toBe(ids[1]);
  });

  it.each([
    [401, 'unauthenticated', /Votre session a expiré/],
    [403, 'role_forbidden', /Votre rôle ne permet pas cette action/],
    [429, 'too_many_requests', /Trop de requêtes/],
    [409, 'idempotency_key_reused', /déjà été envoyé avec un contenu différent/],
  ])('erreur serveur %i : message clair, fenêtre ouverte', async (status, code, message) => {
    mount({ [route]: problem(status, code) });
    await upload();
    await userEvent.click(await importButton());
    expect(await screen.findByText(message, {}, SLOW)).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
