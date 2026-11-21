import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import * as api from './api/responses.fixtures';
import type { MockRoute } from './api/testing';
import { CaseDetailPage } from './CaseDetailPage';
import { caseRoutes, orgUrl, recoveryUrl, renderRecovery } from './testing';

const casePath = recoveryUrl(`/cases/${api.IDS.case}`);
const bundlePath = recoveryUrl(`/bundles/${api.IDS.bundle}`);
const unpaidPath = recoveryUrl('/unpaid');
const activeTransmission = { ...api.bundleShowAfter.data.transmissions[1], state: 'active', revoked_at: null, replaces_id: null };
const bundleWithActive = { data: { ...api.bundleShowAfter.data, transmissions: [activeTransmission] } };

let createObjectURL: ReturnType<typeof vi.fn<(blob: Blob) => string>>;
let clicks: MockInstance<() => void>;
let anchors: string[];
let consoleErrors: MockInstance;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-16T10:00:00Z'));
  anchors = [];
  consoleErrors = vi.spyOn(console, 'error');
  createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:zip');
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
  clicks = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) { anchors.push(this.download); });
});
afterEach(() => {
  const invalidNesting = consoleErrors.mock.calls.flat().map(String).filter((message) => /cannot be a descendant|cannot contain a nested/.test(message));
  consoleErrors.mockRestore();
  expect(invalidNesting).toEqual([]);
  clicks.mockRestore();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const withRoutes = (extra: Record<string, MockRoute>, base: Record<string, MockRoute> = caseRoutes()): Record<string, MockRoute> => ({ ...base, ...extra });
const buttonNames = () => screen.getAllByRole('button').map((button) => norm(button.getAttribute('aria-label') ?? button.textContent));
const closedDetail = { data: { ...api.statusClosed.data } };

describe('détail d’un dossier', () => {
  it('affiche créances, carnet et envoi avec leurs montants du serveur', async () => {
    const { container } = renderRecovery(<CaseDetailPage id={api.IDS.case} />, caseRoutes());

    expect(await screen.findByRole('heading', { level: 1, name: 'Dossier RC-2026-0001' })).toBeTruthy();
    const items = within(await screen.findByRole('table', { name: 'Créances du dossier' }));
    const rows = items.getAllByRole('row').slice(1).map((row) => norm(row.textContent));
    expect(rows[0]).toContain('Septembre 2026');
    expect(rows[0]).toContain('700 €');
    expect(rows[0]).toContain('450 €');
    expect(rows[2]).toContain('Retirée le 16/11/2026');
    expect(rows[2]).toContain('—');
    const acts = within(await screen.findByRole('table', { name: 'Carnet des diligences' }));
    expect(acts.getAllByRole('row').slice(1).map((row) => norm(row.textContent))).toEqual(
      expect.arrayContaining([expect.stringContaining('Appel téléphonique'), expect.stringContaining('Transmission des pièces'), expect.stringContaining('Destinataire : Étude Martin')]),
    );
    expect(acts.getAllByText('Automatique')).toHaveLength(4);
    const bundle = await screen.findByRole('region', { name: 'Pièces du dossier' });
    expect(await within(bundle).findByRole('heading', { name: 'Envoi EP-2026-0001' })).toBeTruthy();
    expect(norm(bundle.textContent)).toContain('1 150 €');
    expect(norm(bundle.textContent)).toContain('1 400 €');
    expect(within(bundle).getAllByRole('listitem')).toHaveLength(5);
    expect(within(bundle).getByText('Pas encore transmis')).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('retire une créance après confirmation et jamais la créance déjà retirée', async () => {
    const { callsTo } = renderRecovery(<CaseDetailPage id={api.IDS.case} />, withRoutes({ [`DELETE ${casePath}/items/${api.IDS.item0}`]: { body: api.removeItem } }));
    await screen.findByRole('table', { name: 'Créances du dossier' });
    expect(screen.queryByRole('button', { name: /Retirer l’échéance de Novembre 2026/ })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Retirer l’échéance de Septembre 2026' }));
    const dialog = await screen.findByRole('dialog');
    expect(callsTo('DELETE', `${casePath}/items/${api.IDS.item0}`)).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Retirer' }));

    await waitFor(() => { expect(callsTo('DELETE', `${casePath}/items/${api.IDS.item0}`)).toHaveLength(1); });
    expect(await screen.findByText('Créance retirée')).toBeTruthy();
  });

  it('ajoute des créances du même locataire, hors dossier actif', async () => {
    const taken = { ...api.unpaidAll.data[0], case: { id: '01a1e981-cc9c-71e1-8cc2-a14a4711da99', number: 'RC-2026-0009' } };
    const stranger = { ...api.unpaidAll.data[1], party: { id: '01a1e981-cbef-7399-91eb-cb5d1d9d2c99', name: 'Paul Martin' } };
    const body = { ...api.unpaidAll, data: [taken, stranger, api.unpaidAll.data[2]] };
    const { callsTo } = renderRecovery(<CaseDetailPage id={api.IDS.case} />, withRoutes({ [`GET ${unpaidPath}`]: { body }, [`POST ${casePath}/items`]: { status: 201, body: api.addItems } }));
    await screen.findByRole('table', { name: 'Créances du dossier' });

    await userEvent.click(screen.getByRole('button', { name: 'Ajouter des créances' }));
    const dialog = await screen.findByRole('dialog');
    const list = await within(dialog).findByRole('list', { name: 'Créances disponibles' });
    expect(within(list).getAllByRole('checkbox')).toHaveLength(1);
    expect(callsTo('GET', unpaidPath).at(-1)?.search.get('lease')).toBe(api.IDS.lease);
    await userEvent.click(within(list).getByRole('checkbox', { name: /Novembre 2026/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter au dossier' }));

    await waitFor(() => { expect(callsTo('POST', `${casePath}/items`)).toHaveLength(1); });
    expect(callsTo('POST', `${casePath}/items`)[0]?.body).toEqual({ installment_ids: [api.IDS.installments[2]] });
    expect(await screen.findByText('Créances ajoutées')).toBeTruthy();
  });

  it('place le dossier en plan de paiement après confirmation', async () => {
    const { callsTo } = renderRecovery(<CaseDetailPage id={api.IDS.case} />, withRoutes({ [`POST ${casePath}/status`]: { body: api.statusInPlan } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Passer en plan de paiement' }));
    expect(callsTo('POST', `${casePath}/status`)).toHaveLength(0);
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Passer en plan' }));

    await waitFor(() => { expect(callsTo('POST', `${casePath}/status`)).toHaveLength(1); });
    expect(callsTo('POST', `${casePath}/status`)[0]?.body).toEqual({ status: 'in_plan' });
  });

  it('clôt le dossier avec un motif, puis le présente clos et sans bouton d’écriture', async () => {
    let closed = false;
    const { callsTo } = renderRecovery(
      <CaseDetailPage id={api.IDS.case} />,
      withRoutes({
        [`GET ${casePath}`]: () => ({ body: closed ? closedDetail : api.caseDetail }),
        [`POST ${casePath}/status`]: () => { closed = true; return { body: api.statusClosed }; },
      }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Clore le dossier' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Motif/ }), "Réglé à l'amiable");
    await userEvent.click(within(dialog).getByRole('button', { name: 'Clore le dossier' }));

    await waitFor(() => { expect(callsTo('POST', `${casePath}/status`)).toHaveLength(1); });
    expect(callsTo('POST', `${casePath}/status`)[0]?.body).toEqual({ status: 'closed', reason: "Réglé à l'amiable" });
    expect(await screen.findByText('Dossier clos')).toBeTruthy();
    expect(screen.getByText(/Motif : Réglé à l'amiable/)).toBeTruthy();
    for (const label of ['Clore le dossier', 'Passer en plan de paiement', 'Déclarer irrécouvrable', 'Ajouter des créances', 'Ajouter une diligence', 'Générer un envoi de pièces']) {
      expect(screen.queryByRole('button', { name: label })).toBeNull();
    }
  });

  it('affiche le refus du serveur pour une transition interdite', async () => {
    renderRecovery(<CaseDetailPage id={api.IDS.case} />, withRoutes({ [`POST ${casePath}/status`]: { status: 409, body: api.problemTransition } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Passer en plan de paiement' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Passer en plan' }));

    expect(await screen.findByText('Changement de statut impossible')).toBeTruthy();
    expect(screen.getByText('Ce changement de statut n’est pas permis depuis le statut actuel du dossier.')).toBeTruthy();
  });

  it('ajoute un acte manuel daté du jour au carnet', async () => {
    const { callsTo } = renderRecovery(<CaseDetailPage id={api.IDS.case} />, withRoutes({ [`POST ${casePath}/acts`]: { status: 201, body: api.actCall } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter une diligence' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Date de l’acte'), { target: { value: '2026-11-10' } });
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Note/ }), 'Le locataire promet un virement');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter au carnet' }));

    await waitFor(() => { expect(callsTo('POST', `${casePath}/acts`)).toHaveLength(1); });
    expect(callsTo('POST', `${casePath}/acts`)[0]?.body).toEqual({ type: 'reminder', performed_on: '2026-11-10', note: 'Le locataire promet un virement', reference: null });
    expect(await screen.findByText('Diligence ajoutée')).toBeTruthy();
  });

  it('affiche le refus de validation du serveur dans la fenêtre sans la fermer', async () => {
    renderRecovery(<CaseDetailPage id={api.IDS.case} />, withRoutes({ [`POST ${casePath}/acts`]: { status: 422, body: api.problemActInvalid } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter une diligence' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter au carnet' }));

    expect(await within(dialog).findByText('Ajout impossible')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('génère un envoi après confirmation', async () => {
    const { callsTo } = renderRecovery(<CaseDetailPage id={api.IDS.case} />, withRoutes({ [`POST ${casePath}/bundles`]: { status: 201, body: api.bundle } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Générer un envoi de pièces' }));
    expect(callsTo('POST', `${casePath}/bundles`)).toHaveLength(0);
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Générer l’envoi' }));

    await waitFor(() => { expect(callsTo('POST', `${casePath}/bundles`)).toHaveLength(1); });
    expect(await screen.findByText('Envoi généré')).toBeTruthy();
    expect(screen.getByText('Envoi EP-2026-0001 : 5 pièces, 1 Ko.')).toBeTruthy();
  });

  it('annonce l’indisponibilité du service PDF sans rien ajouter', async () => {
    renderRecovery(<CaseDetailPage id={api.IDS.case} />, withRoutes({ [`POST ${casePath}/bundles`]: { status: 503, body: api.problemPdfUnavailable, headers: { 'Retry-After': '30' } } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Générer un envoi de pièces' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Générer l’envoi' }));

    expect(await screen.findByText('Génération impossible')).toBeTruthy();
    expect(screen.getByText(/réessayez dans 30 secondes/)).toBeTruthy();
  });

  it('télécharge le ZIP par le client authentifié, sous un nom sûr', async () => {
    const { callsTo } = renderRecovery(<CaseDetailPage id={api.IDS.case} />, withRoutes({ [`GET ${bundlePath}/download`]: { zip: api.ZIP_BYTES } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Télécharger le ZIP' }));

    await waitFor(() => { expect(callsTo('GET', `${bundlePath}/download`)).toHaveLength(1); });
    expect(callsTo('GET', `${bundlePath}/download`)[0]?.headers.get('Accept')).toBe('application/zip');
    await waitFor(() => { expect(createObjectURL).toHaveBeenCalledTimes(1); });
    expect(createObjectURL.mock.calls[0]?.[0].type).toBe('application/zip');
    expect(anchors).toEqual(['Dossier-RC-2026-0001-EP-2026-0001.zip']);
  });

  it('signale l’échec du téléchargement', async () => {
    renderRecovery(<CaseDetailPage id={api.IDS.case} />, withRoutes({ [`GET ${bundlePath}/download`]: { status: 404, body: { ...api.problemCaseNotFound, code: 'recovery_bundle_not_found' } } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Télécharger le ZIP' }));

    expect(await screen.findByText('Téléchargement impossible')).toBeTruthy();
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});

describe('transmission au commissaire de justice', () => {
  const bailiffRoutes: Record<string, MockRoute> = {
    [`GET ${orgUrl('/catalog/vocabularies/contact_category/terms')}`]: { body: api.termsResponse },
    [`GET ${orgUrl('/parties')}`]: { body: api.partiesBailiff },
  };

  const openDialog = async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Transmettre au commissaire de justice' }));
    return screen.findByRole('dialog');
  };

  it('envoie le lien au commissaire choisi pour la durée choisie', async () => {
    const { callsTo } = renderRecovery(<CaseDetailPage id={api.IDS.case} />, withRoutes({ ...bailiffRoutes, [`POST ${bundlePath}/transmissions`]: { status: 201, body: api.transmit } }));
    const dialog = await openDialog();

    await userEvent.click(await within(dialog).findByRole('combobox', { name: /^Commissaire de justice/ }));
    expect(screen.queryByRole('option', { name: /Étude sans e-mail/ })).toBeNull();
    await userEvent.click(await screen.findByRole('option', { name: /Étude Martin/ }));
    await userEvent.click(within(dialog).getByRole('combobox', { name: /^Validité/ }));
    await userEvent.click(await screen.findByRole('option', { name: '14 jours' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Envoyer le lien' }));

    await waitFor(() => { expect(callsTo('POST', `${bundlePath}/transmissions`)).toHaveLength(1); });
    expect(callsTo('POST', `${bundlePath}/transmissions`)[0]?.body).toEqual({ recipient_party_id: api.IDS.bailiff, valid_days: 14 });
    expect(await screen.findByText('Lien envoyé')).toBeTruthy();
  });

  it('propose 7 jours par défaut', async () => {
    const { callsTo } = renderRecovery(<CaseDetailPage id={api.IDS.case} />, withRoutes({ ...bailiffRoutes, [`POST ${bundlePath}/transmissions`]: { status: 201, body: api.transmit } }));
    const dialog = await openDialog();
    await userEvent.click(await within(dialog).findByRole('combobox', { name: /^Commissaire de justice/ }));
    await userEvent.click(await screen.findByRole('option', { name: /Étude Martin/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Envoyer le lien' }));

    await waitFor(() => { expect(callsTo('POST', `${bundlePath}/transmissions`)).toHaveLength(1); });
    expect((callsTo('POST', `${bundlePath}/transmissions`)[0]?.body as { valid_days: number }).valid_days).toBe(7);
  });

  it('refuse d’envoyer sans destinataire', async () => {
    const { callsTo } = renderRecovery(<CaseDetailPage id={api.IDS.case} />, withRoutes({ ...bailiffRoutes, [`POST ${bundlePath}/transmissions`]: { status: 201, body: api.transmit } }));
    const dialog = await openDialog();
    await within(dialog).findByRole('combobox', { name: /^Commissaire de justice/ });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Envoyer le lien' }));

    expect(callsTo('POST', `${bundlePath}/transmissions`)).toHaveLength(0);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('prévient quand aucun commissaire n’est joignable', async () => {
    const onlyWithoutEmail = { ...api.partiesBailiff, data: [api.partiesBailiff.data[1]] };
    renderRecovery(<CaseDetailPage id={api.IDS.case} />, withRoutes({ ...bailiffRoutes, [`GET ${orgUrl('/parties')}`]: { body: onlyWithoutEmail } }));
    const dialog = await openDialog();

    expect(await within(dialog).findByText('Aucun commissaire de justice joignable')).toBeTruthy();
    expect(within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Envoyer le lien' }).disabled).toBe(true);
  });

  it('affiche le refus du serveur dans la fenêtre', async () => {
    renderRecovery(<CaseDetailPage id={api.IDS.case} />, withRoutes({ ...bailiffRoutes, [`POST ${bundlePath}/transmissions`]: { status: 422, body: api.problemRecipientInvalid } }));
    const dialog = await openDialog();
    await userEvent.click(await within(dialog).findByRole('combobox', { name: /^Commissaire de justice/ }));
    await userEvent.click(await screen.findByRole('option', { name: /Étude Martin/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Envoyer le lien' }));

    expect(await within(dialog).findByText('Transmission impossible')).toBeTruthy();
    expect(within(dialog).getByText(/Le destinataire doit être un commissaire de justice/)).toBeTruthy();
  });
});

describe('historique des transmissions', () => {
  const activeRoutes = (extra: Record<string, MockRoute>): Record<string, MockRoute> => withRoutes({ [`GET ${bundlePath}`]: { body: bundleWithActive }, ...extra });

  it('révoque un lien actif avec un motif, après confirmation', async () => {
    const { callsTo } = renderRecovery(<CaseDetailPage id={api.IDS.case} />, activeRoutes({ [`POST ${recoveryUrl(`/transmissions/${api.IDS.transmission}/revoke`)}`]: { body: api.revoke } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Révoquer le lien envoyé à etude@martin-cj.fr' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Motif/ }), 'Envoyé à la mauvaise étude');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Révoquer le lien' }));

    const path = recoveryUrl(`/transmissions/${api.IDS.transmission}/revoke`);
    await waitFor(() => { expect(callsTo('POST', path)).toHaveLength(1); });
    expect(callsTo('POST', path)[0]?.body).toEqual({ reason: 'Envoyé à la mauvaise étude' });
    expect(await screen.findByText('Lien révoqué')).toBeTruthy();
  });

  it('renvoie un lien pour la durée choisie, y compris depuis un lien révoqué', async () => {
    const path = recoveryUrl(`/transmissions/${api.IDS.transmission}/resend`);
    const { callsTo } = renderRecovery(<CaseDetailPage id={api.IDS.case} />, withRoutes({ [`GET ${bundlePath}`]: { body: api.bundleShowAfter }, [`POST ${path}`]: { status: 201, body: api.resend } }));
    const table = await screen.findByRole('table', { name: 'Historique des transmissions' });
    expect(within(table).queryByRole('button', { name: /Révoquer le lien/ })).toBeNull();
    const [, oldest] = within(table).getAllByRole('button', { name: 'Renvoyer le lien à etude@martin-cj.fr' });
    if (!oldest) throw new Error('Bouton de renvoi absent');
    await userEvent.click(oldest);
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Renvoyer le lien' }));

    await waitFor(() => { expect(callsTo('POST', path)).toHaveLength(1); });
    expect(callsTo('POST', path)[0]?.body).toEqual({ valid_days: 7 });
    expect(await screen.findByText('Nouveau lien envoyé')).toBeTruthy();
  });

  it('affiche le refus du serveur pour une révocation répétée', async () => {
    renderRecovery(<CaseDetailPage id={api.IDS.case} />, activeRoutes({ [`POST ${recoveryUrl(`/transmissions/${api.IDS.transmission}/revoke`)}`]: { status: 409, body: api.problemRevokeAgain } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Révoquer le lien envoyé à etude@martin-cj.fr' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Révoquer le lien' }));

    expect(await screen.findByText('Révocation impossible')).toBeTruthy();
    expect(screen.getByText('Cette transmission est déjà révoquée.')).toBeTruthy();
  });
});

describe('droits et états', () => {
  it('ne montre aucun bouton d’écriture au comptable, qui garde la lecture et le ZIP', async () => {
    renderRecovery(<CaseDetailPage id={api.IDS.case} />, withRoutes({ [`GET ${bundlePath}`]: { body: bundleWithActive } }), { role: 'accountant' });
    await screen.findByRole('table', { name: 'Historique des transmissions' });

    const names = buttonNames();
    expect(names).toContain('Télécharger le ZIP');
    for (const forbidden of ['Ajouter des créances', 'Ajouter une diligence', 'Générer un envoi de pièces', 'Transmettre au commissaire de justice', 'Passer en plan de paiement', 'Clore le dossier', 'Déclarer irrécouvrable']) {
      expect(names).not.toContain(forbidden);
    }
    expect(names.filter((name) => /^(Retirer|Révoquer|Renvoyer)/.test(name))).toEqual([]);
  });

  it('laisse le propriétaire, l’administrateur et le gestionnaire écrire', async () => {
    for (const role of ['owner', 'admin', 'manager'] as const) {
      const { unmount } = renderRecovery(<CaseDetailPage id={api.IDS.case} />, caseRoutes(), { role });
      expect(await screen.findByRole('button', { name: 'Ajouter une diligence' })).toBeTruthy();
      unmount();
    }
  });

  it('présente un dossier irrécouvrable sans bouton d’écriture même pour le gestionnaire', async () => {
    const detail = { data: { ...api.statusClosed.data, status: 'uncollectible' } };
    renderRecovery(<CaseDetailPage id={api.IDS.case} />, caseRoutes(detail));

    expect(await screen.findByText('Dossier irrécouvrable')).toBeTruthy();
    await screen.findByRole('table', { name: 'Créances du dossier' });
    expect(screen.queryByRole('button', { name: 'Ajouter des créances' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Générer un envoi de pièces' })).toBeNull();
  });

  it('affiche « introuvable » pour un dossier d’une autre organisation', async () => {
    renderRecovery(<CaseDetailPage id={api.IDS.case} />, { [`GET ${casePath}`]: { status: 404, body: api.problemCaseNotFound } });
    expect(await screen.findByText('Ce dossier n’existe pas')).toBeTruthy();
  });

  it('signale une erreur de chargement', async () => {
    renderRecovery(<CaseDetailPage id={api.IDS.case} />, { [`GET ${casePath}`]: { status: 403, body: api.problemForbidden } });
    expect(await screen.findByText('Votre rôle ne permet pas cette action sur le recouvrement.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /Dossier RC/ })).toBeNull();
  });

  it('affiche le chargement avant la réponse', () => {
    renderRecovery(<CaseDetailPage id={api.IDS.case} />, caseRoutes());
    expect(screen.getByRole('status', { name: 'Chargement du dossier' })).toBeTruthy();
  });

  it('indique l’absence d’envoi et de diligence', async () => {
    renderRecovery(<CaseDetailPage id={api.IDS.case} />, withRoutes({
      [`GET ${casePath}`]: { body: { data: { ...api.caseDetail.data, bundles: [] } } },
      [`GET ${casePath}/acts`]: { body: { ...api.actsPage, data: [] } },
    }));
    expect(await screen.findByText('Aucun envoi généré')).toBeTruthy();
    expect(await screen.findByText('Aucune diligence')).toBeTruthy();
  });
});
