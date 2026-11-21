import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { saveBlob } from '../finances/rent/download';
import { ActivityJournalPage } from './ActivityJournalPage';
import * as api from './api/fixtures';
import { activityUrl, problem, renderActivity, twice } from './testing';

vi.mock('../finances/rent/download', () => ({ saveBlob: vi.fn() }));

const SLOW = { timeout: 4000 };
const list = `GET ${activityUrl()}`;

async function loaded() {
  return screen.findByRole('list', { name: 'Entrées du journal' }, SLOW);
}

describe('journal d’activité (propriétaire et administrateur)', () => {
  it('affiche les entrées du serveur dans le fuseau de l’organisation, avec origine et lien vers la fiche', async () => {
    const { container, calls } = renderActivity(<ActivityJournalPage />, { [list]: { body: api.page([api.row, api.rowDeletedAuthor]) } });
    const entries = await loaded();

    expect(within(entries).getByText('Enregistrement d\'un paiement de loyer')).toBeTruthy();
    expect(entries.textContent).toContain('14/03/2026 à 10:30');
    expect(entries.textContent).toContain('Camille Martin');
    expect(entries.textContent).toContain('Origine : 203.0.113.0/24 · Chrome sur macOS');
    expect(entries.textContent).toContain('Alex Dupont (compte supprimé ou désactivé)');
    expect(within(entries).getByRole('link', { name: 'Ouvrir la fiche' }).getAttribute('href')).toBe(`/baux/${api.IDS.lease}`);
    expect(screen.getByText('Heures affichées : Europe/Paris (UTC+1)')).toBeTruthy();
    expect(calls.some((call) => call.path === activityUrl() && call.search.get('per_page') === '25')).toBe(true);
    await expectNoA11yViolations(container);
  });

  it('ne décale pas l’heure au changement d’heure et suit le fuseau choisi', async () => {
    renderActivity(<ActivityJournalPage />, { [list]: { body: api.page([api.rowSystem, api.row]) } });
    expect((await loaded()).textContent).toContain('29/03/2026 à 03:30');
  });

  it('affiche les heures du Québec pour une organisation canadienne', async () => {
    renderActivity(<ActivityJournalPage />, { [list]: { body: api.page([api.row]) } }, { timezone: 'America/Toronto' });
    expect((await loaded()).textContent).toContain('14/03/2026 à 05:30');
  });

  it('applique les filtres : fin incluse envoyée en borne exclusive, retour à la première page', async () => {
    const { calls } = renderActivity(<ActivityJournalPage />, { [list]: { body: api.page([api.row], 'suite') } });
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    await waitFor(() => { expect(calls.some((call) => call.search.get('cursor') === 'suite')).toBe(true); }, SLOW);

    fireEvent.change(screen.getByLabelText('Du (inclus)'), { target: { value: '2026-03-01' } });
    fireEvent.change(screen.getByLabelText('Au (inclus)'), { target: { value: '2026-03-31' } });
    await userEvent.click(screen.getByRole('combobox', { name: /Type d’action/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Paiement' }));
    await userEvent.click(screen.getByRole('button', { name: 'Appliquer les filtres' }));

    await waitFor(() => {
      expect(calls.some((call) => call.search.get('from') === '2026-03-01' && call.search.get('to') === '2026-04-01' && call.search.get('type') === 'paiement' && call.search.get('cursor') === null)).toBe(true);
    }, SLOW);
  });

  it('propose les membres comme auteurs et filtre par auteur', async () => {
    const { calls } = renderActivity(<ActivityJournalPage />, { [list]: { body: api.page([api.row]) } });
    await loaded();
    await userEvent.click(screen.getByRole('combobox', { name: /Auteur/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Alex Dupont' }));
    await userEvent.click(screen.getByRole('button', { name: 'Appliquer les filtres' }));
    await waitFor(() => { expect(calls.some((call) => call.search.get('actor') === '0198a0a0-0000-7000-8000-0000000000a2')).toBe(true); }, SLOW);
  });

  it('refuse une période inversée ou de plus de 366 jours sans appeler le serveur', async () => {
    const { calls } = renderActivity(<ActivityJournalPage />, { [list]: { body: api.page([api.row]) } });
    await loaded();
    const before = calls.length;

    fireEvent.change(screen.getByLabelText('Du (inclus)'), { target: { value: '2026-03-10' } });
    fireEvent.change(screen.getByLabelText('Au (inclus)'), { target: { value: '2026-03-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Appliquer les filtres' }));
    expect(await screen.findByText('La date de fin doit être postérieure ou égale à celle de début.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Du (inclus)'), { target: { value: '2025-01-01' } });
    fireEvent.change(screen.getByLabelText('Au (inclus)'), { target: { value: '2026-01-02' } });
    await userEvent.click(screen.getByRole('button', { name: 'Appliquer les filtres' }));
    expect(await screen.findByText('La période ne peut pas dépasser 366 jours.')).toBeTruthy();
    expect(calls).toHaveLength(before);
  });

  it('exige un identifiant d’élément au bon format', async () => {
    renderActivity(<ActivityJournalPage />, { [list]: { body: api.page([api.row]) } });
    await loaded();
    await userEvent.click(screen.getByRole('combobox', { name: /Type d’élément/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Bail' }));
    await userEvent.type(screen.getByLabelText('Identifiant de l’élément'), 'pas-un-uuid');
    await userEvent.click(screen.getByRole('button', { name: 'Appliquer les filtres' }));
    expect(await screen.findByText('Cet identifiant n’a pas le bon format.')).toBeTruthy();
  });

  it('distingue journal vide et filtres sans résultat', async () => {
    renderActivity(<ActivityJournalPage />, { [list]: { body: api.page([]) } });
    expect(await screen.findByText('Le journal est vide pour le moment.', {}, SLOW)).toBeTruthy();
    await userEvent.click(screen.getByRole('combobox', { name: /Type d’action/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Export' }));
    await userEvent.click(screen.getByRole('button', { name: 'Appliquer les filtres' }));
    expect(await screen.findByText('Aucune entrée ne correspond à ces filtres.', {}, SLOW)).toBeTruthy();
  });

  it('affiche l’échec sans données inventées et se rétablit avec Réessayer', async () => {
    renderActivity(<ActivityJournalPage />, { [list]: twice(problem(500, 'server_error'), { body: api.page([api.row]) }) });
    expect(await screen.findByText(/Impossible de charger le journal d’activité/, {}, SLOW)).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Entrées du journal' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await loaded()).toBeTruthy();
  });

  it('affiche un accès refusé sur 403 et une session expirée sur 401', async () => {
    const denied = renderActivity(<ActivityJournalPage />, { [list]: problem(403, 'role_forbidden') });
    expect(await screen.findByText('Accès refusé', {}, SLOW)).toBeTruthy();
    denied.unmount();

    renderActivity(<ActivityJournalPage />, { [list]: problem(401, 'unauthenticated') });
    expect(await screen.findByText(/Votre session a expiré/, {}, SLOW)).toBeTruthy();
  });

  it('signale le trop-plein de requêtes (429)', async () => {
    renderActivity(<ActivityJournalPage />, { [list]: { ...problem(429, 'too_many_requests'), headers: { 'Retry-After': '30' } } });
    expect(await screen.findByText(/Trop de requêtes/, {}, SLOW)).toBeTruthy();
  });

  it('un échec de chargement des droits n’affiche aucune donnée', async () => {
    const { calls } = renderActivity(<ActivityJournalPage />, {}, { info: { roles: () => Promise.reject(new Error('panne')) } });
    expect(await screen.findByText(/Impossible de charger vos droits/, {}, SLOW)).toBeTruthy();
    expect(calls).toHaveLength(0);
  });
});

describe('détail d’une entrée', () => {
  const detailUrl = `GET ${activityUrl(`/${api.IDS.entry}`)}`;

  it('ouvre le détail avec différentiel et références, rendus en texte', async () => {
    const { container } = renderActivity(<ActivityJournalPage />, { [list]: { body: api.page([api.row]) }, [detailUrl]: { body: { data: api.detail } } });
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: 'Détails : Enregistrement d\'un paiement de loyer' }));

    const dialog = await screen.findByRole('dialog', { name: 'Détail de l’entrée' }, SLOW);
    expect(await within(dialog).findByText('REQ-4242', {}, SLOW)).toBeTruthy();
    expect(dialog.textContent).toContain('status : draft → sent');
    expect(dialog.textContent).toContain('amount : 12000 → vide');
    expect(dialog.textContent).toContain('<script>alert(1)</script>');
    expect(dialog.querySelector('script')).toBeNull();
    expect(dialog.querySelector('b')).toBeNull();
    expect(within(dialog).getByRole('region', { name: 'Contenu du détail' }).getAttribute('tabindex')).toBe('0');
    await expectNoA11yViolations(container.ownerDocument.body);
  });

  it('annonce une entrée introuvable (404) et permet de fermer', async () => {
    renderActivity(<ActivityJournalPage />, { [list]: { body: api.page([api.row]) }, [detailUrl]: problem(404, 'activity_not_found') });
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: /Détails/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Détail de l’entrée' });
    expect(await within(dialog).findByText(/n’existe pas dans le journal/, {}, SLOW)).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => { expect(screen.queryByRole('dialog', { name: 'Détail de l’entrée' })).toBeNull(); });
  });
});

describe('export CSV', () => {
  const exportUrl = activityUrl('/export');

  async function openExport() {
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: 'Exporter en CSV' }));
    return screen.findByRole('dialog', { name: 'Exporter le journal d’activité' });
  }

  it('télécharge le CSV avec les filtres appliqués', async () => {
    const { callsTo } = renderActivity(<ActivityJournalPage />, { [list]: { body: api.page([api.row]) }, [`GET ${exportUrl}`]: { csv: 'date\n' } });
    const dialog = await openExport();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Exporter' }));

    await waitFor(() => { expect(saveBlob).toHaveBeenCalled(); }, SLOW);
    expect(vi.mocked(saveBlob).mock.calls.at(-1)?.[1]).toMatch(/^journal-activite-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(callsTo('GET', exportUrl)).toHaveLength(1);
  });

  it('exige une preuve de double authentification récente puis rejoue l’export', async () => {
    const confirmTwoFactor = vi.fn(() => Promise.resolve({ status: 'ok' as const }));
    const { callsTo } = renderActivity(
      <ActivityJournalPage />,
      { [list]: { body: api.page([api.row]) }, [`GET ${exportUrl}`]: twice(problem(403, 'reauthentication_required'), { csv: 'date\n' }) },
      { info: { confirmTwoFactor } },
    );
    vi.mocked(saveBlob).mockClear();
    const dialog = await openExport();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Exporter' }));

    const proof = await screen.findByRole('dialog', { name: 'Confirmez votre identité' }, SLOW);
    await userEvent.type(within(proof).getByLabelText(/Code de double authentification/), '123456');
    await userEvent.click(within(proof).getByRole('button', { name: 'Confirmer' }));

    await waitFor(() => { expect(callsTo('GET', exportUrl)).toHaveLength(2); }, SLOW);
    expect(confirmTwoFactor).toHaveBeenCalledWith('123456');
    await waitFor(() => { expect(saveBlob).toHaveBeenCalledTimes(1); }, SLOW);
  });

  it('abandonner la preuve annule l’export sans fichier', async () => {
    renderActivity(<ActivityJournalPage />, { [list]: { body: api.page([api.row]) }, [`GET ${exportUrl}`]: problem(403, 'reauthentication_required') });
    vi.mocked(saveBlob).mockClear();
    const dialog = await openExport();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Exporter' }));
    const proof = await screen.findByRole('dialog', { name: 'Confirmez votre identité' }, SLOW);
    await userEvent.click(within(proof).getByRole('button', { name: 'Annuler' }));

    expect(await within(dialog).findByText(/Export annulé/, {}, SLOW)).toBeTruthy();
    expect(saveBlob).not.toHaveBeenCalled();
  });

  it('sans double authentification activée, renvoie vers la sécurité du compte', async () => {
    renderActivity(<ActivityJournalPage />, { [list]: { body: api.page([api.row]) }, [`GET ${exportUrl}`]: problem(403, 'two_factor_required') });
    const dialog = await openExport();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Exporter' }));
    expect((await within(dialog).findByRole('link', { name: 'Ouvrir Connexion et sécurité' }, SLOW)).getAttribute('href')).toBe('/compte/securite');
  });

  it('annonce la limite de 5 exports par heure et l’export trop volumineux', async () => {
    renderActivity(<ActivityJournalPage />, { [list]: { body: api.page([api.row]) }, [`GET ${exportUrl}`]: twice({ ...problem(429, 'too_many_requests'), headers: { 'Retry-After': '1200' } }, problem(422, 'activity_export_too_large')) });
    const dialog = await openExport();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Exporter' }));
    expect(await within(dialog).findByText(/5 exports par heure au plus\. Réessayez dans 20 minutes/, {}, SLOW)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Exporter' }));
    expect(await within(dialog).findByText(/trop d’entrées pour un export/, {}, SLOW)).toBeTruthy();
  });
});

describe('selon le rôle', () => {
  it('un gestionnaire sans fiche ne voit aucune donnée et aucun appel de liste', async () => {
    const { calls } = renderActivity(<ActivityJournalPage />, {}, { role: 'manager' });
    expect(await screen.findByText('Ouvrez l’historique depuis une fiche', {}, SLOW)).toBeTruthy();
    expect(calls.filter((call) => call.path === activityUrl())).toHaveLength(0);
  });

  it('un gestionnaire avec une fiche voit l’historique : ni détail, ni export, ni auteur, ni origine', async () => {
    const { calls } = renderActivity(
      <ActivityJournalPage />,
      { [list]: { body: api.page([api.historyRow]) } },
      { role: 'manager', search: `entite=lease&entite_id=${api.IDS.lease}` },
    );
    const entries = await loaded();

    expect(entries.textContent).toContain('Modification de bail');
    expect(entries.textContent).not.toContain('Origine');
    expect(screen.queryByRole('button', { name: /Détails/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Exporter en CSV' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: /Auteur/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Voir tout le journal' })).toBeNull();
    expect(calls.find((call) => call.path === activityUrl())?.search.get('subject_type')).toBe('lease');
    expect(calls.find((call) => call.path === activityUrl())?.search.get('subject_id')).toBe(api.IDS.lease);
  });

  it('un comptable n’a aucun accès et rien n’est demandé', async () => {
    const { calls } = renderActivity(<ActivityJournalPage />, {}, { role: 'accountant', search: `entite=lease&entite_id=${api.IDS.lease}` });
    expect(await screen.findByText('Journal indisponible pour votre rôle', {}, SLOW)).toBeTruthy();
    expect(calls.filter((call) => call.path === activityUrl())).toHaveLength(0);
  });

  it('un administrateur peut cibler une fiche : filtre verrouillé, retour au journal complet, export inclus', async () => {
    const { calls } = renderActivity(<ActivityJournalPage />, { [list]: { body: api.page([api.row]) } }, { role: 'admin', search: `entite=lease&entite_id=${api.IDS.lease}` });
    await loaded();
    expect(screen.getByText('Historique : Bail')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Voir tout le journal' }).getAttribute('href')).toBe('/journal');
    expect(screen.queryByRole('combobox', { name: /Type d’élément/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Exporter en CSV' })).toBeTruthy();
    expect(calls.find((call) => call.path === activityUrl())?.search.get('subject_id')).toBe(api.IDS.lease);
  });
});
