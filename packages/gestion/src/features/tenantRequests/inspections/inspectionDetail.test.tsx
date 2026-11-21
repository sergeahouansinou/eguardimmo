import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { cursorPage } from '../testing/fixtures';
import { orgUrl, problem, renderTenantRequests } from '../testing/render';
import type { MockRoute } from '../testing/render';
import { createApiInspectionsSource } from './api';
import { INSPECTION_IDS, inspectionEntry, inspectionExit, inspectionPublished, remarkAnswered, remarkOpen } from './fixtures';
import { InspectionDetailPage } from './InspectionDetailPage';
import { InspectionsSourceProvider } from './source';

const SLOW = { timeout: 4000 };
const oneUrl = (id: string) => orgUrl(`/inspections/${id}`);
const remarksUrl = (id: string) => `${oneUrl(id)}/remarks`;

function renderDetail(row: Record<string, unknown>, routes: Record<string, MockRoute> = {}, options: { role?: string | null } = {}) {
  const id = String(row.id);
  return renderTenantRequests(
    (context) => (
      <InspectionsSourceProvider source={createApiInspectionsSource(context)}>
        <InspectionDetailPage id={id} />
      </InspectionsSourceProvider>
    ),
    {
      [`GET ${oneUrl(id)}`]: { body: { data: row } },
      [`GET ${remarksUrl(id)}`]: { body: cursorPage([remarkOpen, remarkAnswered]) },
      [`GET ${orgUrl(`/inspection-remark-files/${INSPECTION_IDS.photo}`)}`]: { file: { type: 'image/jpeg', content: 'jpeg' } },
      ...routes,
    },
    options,
  );
}

describe('état des lieux : fiche', () => {
  it('affiche la synthèse, les signataires et les remarques avec leur photo', async () => {
    URL.createObjectURL = () => 'blob:photo';
    URL.revokeObjectURL = () => undefined;
    const { container } = renderDetail(inspectionEntry);
    expect(await screen.findByRole('heading', { name: 'État des lieux d’entrée' }, SLOW)).toBeTruthy();
    expect(screen.getByText('Sophie Martin')).toBeTruthy();
    expect(await screen.findByText('Des traces d’humidité sont visibles dans la salle de bains.', {}, SLOW)).toBeTruthy();
    expect(await screen.findByText('Demande de complément')).toBeTruthy();
    expect(await screen.findByText('Chauffage')).toBeTruthy();
    expect(await screen.findByText(/Ajouté à l’état d’entrée\./)).toBeTruthy();
    expect(await screen.findByRole('img', { name: 'Photo 1 de la remarque' }, SLOW)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Modifier' })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('publie après confirmation et appelle la route de publication', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderDetail(inspectionEntry, { [`POST ${oneUrl(INSPECTION_IDS.entry)}/publish`]: { body: { data: inspectionPublished } } });
    await user.click(await screen.findByRole('button', { name: 'Publier' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Une fois publié, il est figé/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Publier' }));
    await waitFor(() => { expect(callsTo('POST', `${oneUrl(INSPECTION_IDS.entry)}/publish`)).toHaveLength(1); }, SLOW);
  });

  it('affiche le refus de publier une sortie sans conformité', async () => {
    const user = userEvent.setup();
    renderDetail(inspectionExit, {
      [`POST ${oneUrl(INSPECTION_IDS.exit)}/publish`]: problem(409, 'inspection_not_publishable', 'Indiquez d’abord si l’état des lieux de sortie est conforme à celui d’entrée.'),
    });
    await user.click(await screen.findByRole('button', { name: 'Publier' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Publier' }));
    expect(await within(dialog).findByText('Indiquez d’abord si l’état des lieux de sortie est conforme à celui d’entrée.', {}, SLOW)).toBeTruthy();
  });

  it('modifie la date, l’auteur et les signataires avec la version lue', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderDetail(inspectionEntry, { [`PATCH ${oneUrl(INSPECTION_IDS.entry)}`]: { body: { data: { ...inspectionEntry, lock_version: 2 } } } });
    await user.click(await screen.findByRole('button', { name: 'Modifier' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Réalisé le/), { target: { value: '2026-01-02' } });
    await user.click(within(dialog).getByRole('button', { name: 'Retirer le signataire 2' }));
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer les corrections' }));
    await waitFor(() => { expect(callsTo('PATCH', oneUrl(INSPECTION_IDS.entry))).toHaveLength(1); }, SLOW);
    expect(callsTo('PATCH', oneUrl(INSPECTION_IDS.entry))[0]?.body).toEqual({
      lock_version: 1,
      performed_on: '2026-01-02',
      performed_by: 'agent',
      exit_matches_entry: null,
      signatories: [{ name: 'Awa Diallo', capacity: 'Locataire', date: '2026-01-03' }],
    });
  });

  it('traduit inspection_published et inspection_stale_version en français', async () => {
    const user = userEvent.setup();
    let attempt = 0;
    renderDetail(inspectionEntry, {
      [`PATCH ${oneUrl(INSPECTION_IDS.entry)}`]: () => {
        attempt += 1;
        return attempt === 1 ? problem(409, 'inspection_stale_version', 'English stale') : problem(409, 'inspection_published', 'English published');
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Modifier' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer les corrections' }));
    expect(await within(dialog).findByText(/modifié depuis votre lecture/, {}, SLOW)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer les corrections' }));
    expect(await within(dialog).findByText(/publié, donc figé/, {}, SLOW)).toBeTruthy();
    expect(within(dialog).queryByText('English published')).toBeNull();
  });

  it('répond à une remarque avec la décision et le texte', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderDetail(inspectionEntry, {
      [`POST ${orgUrl(`/inspection-remarks/${INSPECTION_IDS.remarkOpen}/answer`)}`]: { body: { data: { ...remarkOpen, status: 'answered', answer: 'accepted', answer_body: 'Ajouté.' } } },
    });
    await user.click(await screen.findByRole('button', { name: 'Répondre' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('combobox', { name: /Décision/ }));
    await user.click(await screen.findByRole('option', { name: 'Demande acceptée' }));
    fireEvent.change(within(dialog).getByLabelText(/Réponse/), { target: { value: 'Les traces seront ajoutées à l’état d’entrée.' } });
    await user.click(within(dialog).getByRole('button', { name: 'Envoyer la réponse' }));
    const path = orgUrl(`/inspection-remarks/${INSPECTION_IDS.remarkOpen}/answer`);
    await waitFor(() => { expect(callsTo('POST', path)).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', path)[0]?.body).toEqual({ answer: 'accepted', body: 'Les traces seront ajoutées à l’état d’entrée.' });
  });

  it('refuse une réponse trop courte sans appeler le serveur et traduit le 409 déjà répondue', async () => {
    const user = userEvent.setup();
    const path = orgUrl(`/inspection-remarks/${INSPECTION_IDS.remarkOpen}/answer`);
    const { callsTo } = renderDetail(inspectionEntry, { [`POST ${path}`]: problem(409, 'inspection_remark_answered', 'English') });
    await user.click(await screen.findByRole('button', { name: 'Répondre' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Réponse/), { target: { value: 'a' } });
    await user.click(within(dialog).getByRole('button', { name: 'Envoyer la réponse' }));
    expect(await within(dialog).findByText('Écrivez une réponse de 2 caractères au moins.')).toBeTruthy();
    expect(callsTo('POST', path)).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText(/Réponse/), { target: { value: 'Noté, merci.' } });
    await user.click(within(dialog).getByRole('button', { name: 'Envoyer la réponse' }));
    expect(await within(dialog).findByText(/a déjà reçu une réponse/, {}, SLOW)).toBeTruthy();
  });

  it('n’offre ni modification ni publication sur un état publié', async () => {
    renderDetail(inspectionPublished);
    expect(await screen.findByText('État des lieux publié et figé', {}, SLOW)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Publier' })).toBeNull();
  });

  it('télécharge le PDF par la route du document', async () => {
    const user = userEvent.setup();
    URL.createObjectURL = () => 'blob:pdf';
    URL.revokeObjectURL = () => undefined;
    const { callsTo } = renderDetail(inspectionEntry, { [`GET ${oneUrl(INSPECTION_IDS.entry)}/document`]: { file: { type: 'application/pdf', content: '%PDF' } } });
    await user.click(await screen.findByRole('button', { name: 'Télécharger le PDF' }, SLOW));
    await waitFor(() => { expect(callsTo('GET', `${oneUrl(INSPECTION_IDS.entry)}/document`)).toHaveLength(1); }, SLOW);
  });

  it('affiche l’introuvable sur 404 et refuse le comptable sans appel', async () => {
    const { unmount } = renderTenantRequests(
      (context) => (
        <InspectionsSourceProvider source={createApiInspectionsSource(context)}>
          <InspectionDetailPage id={INSPECTION_IDS.entry} />
        </InspectionsSourceProvider>
      ),
      { [`GET ${oneUrl(INSPECTION_IDS.entry)}`]: problem(404, 'inspection_not_found') },
    );
    expect(await screen.findByText('État des lieux introuvable', {}, SLOW)).toBeTruthy();
    unmount();
    const { calls } = renderDetail(inspectionEntry, {}, { role: 'accountant' });
    expect(await screen.findByText('Page indisponible pour votre rôle')).toBeTruthy();
    expect(calls.filter((call) => call.path === oneUrl(INSPECTION_IDS.entry))).toHaveLength(0);
  });
});
