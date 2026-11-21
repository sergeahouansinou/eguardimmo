import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@eguardimmo/api';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { announcementOf, fakeAnnouncements, pageOf, renderAnnouncements } from '../../../test/announcements';
import { ANNOUNCEMENT_ATTACHMENT_ID, ANNOUNCEMENT_ID, SECOND_ANNOUNCEMENT_ID, announcementFixture, readAnnouncementFixture } from '../testing';
import { AnnouncementDetailPage } from './DetailPage';
import { AnnouncementsListPage } from './ListPage';

describe('liste des annonces', () => {
  it('affiche les annonces avec leur état de lecture et un lien vers chaque détail', async () => {
    const source = fakeAnnouncements({
      list: () => Promise.resolve(pageOf([announcementFixture(), readAnnouncementFixture({ id: SECOND_ANNOUNCEMENT_ID, subject: 'Assemblée générale' })])),
    });
    const { container } = renderAnnouncements(<AnnouncementsListPage />, { source });

    const list = await screen.findByRole('list', { name: 'Annonces' });
    const links = within(list).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]?.getAttribute('href')).toBe(`/annonces/${ANNOUNCEMENT_ID}`);
    expect(links[0]?.textContent).toContain('Coupure d’eau lundi');
    expect(links[0]?.textContent).toContain('non lue');
    expect(links[1]?.textContent).not.toContain('non lue');
    expect(screen.getByRole('heading', { level: 1, name: 'Annonces' })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('accorde « pièce jointe » au singulier pour une pièce et au pluriel au-delà', async () => {
    const one = { id: ANNOUNCEMENT_ATTACHMENT_ID, name: 'avis.pdf', size_bytes: 1024 };
    const source = fakeAnnouncements({
      list: () =>
        Promise.resolve(
          pageOf([
            announcementFixture({ attachments: [one] }),
            readAnnouncementFixture({ id: SECOND_ANNOUNCEMENT_ID, subject: 'Assemblée générale', attachments: [one, { ...one, id: ANNOUNCEMENT_ID }] }),
          ]),
        ),
    });
    renderAnnouncements(<AnnouncementsListPage />, { source });

    const list = await screen.findByRole('list', { name: 'Annonces' });
    const links = within(list).getAllByRole('link');
    expect(links[0]?.textContent).toContain('1 pièce jointe');
    expect(links[0]?.textContent).not.toContain('pièces jointes');
    expect(links[1]?.textContent).toContain('2 pièces jointes');
    expect(list.textContent).not.toContain('(s)');
  });

  it('charge la page suivante à la demande avec le curseur serveur', async () => {
    const user = userEvent.setup();
    const source = fakeAnnouncements({
      list: (cursor) => Promise.resolve(cursor === null ? pageOf([announcementFixture()], 'suite') : pageOf([readAnnouncementFixture({ id: SECOND_ANNOUNCEMENT_ID, subject: 'Assemblée générale' })])),
    });
    renderAnnouncements(<AnnouncementsListPage />, { source });

    await user.click(await screen.findByRole('button', { name: 'Afficher plus' }));

    expect(await screen.findByText('Assemblée générale')).toBeTruthy();
    expect(source.list).toHaveBeenLastCalledWith('suite', 25);
    expect(screen.queryByRole('button', { name: 'Afficher plus' })).toBeNull();
  });

  it('indique l’absence d’annonce sans rien inventer', async () => {
    renderAnnouncements(<AnnouncementsListPage />);
    expect(await screen.findByText('Aucune annonce pour le moment')).toBeTruthy();
  });

  it('propose de réessayer après une panne serveur, avec un message clair', async () => {
    const user = userEvent.setup();
    let calls = 0;
    const source = fakeAnnouncements({
      list: () => {
        calls += 1;
        return calls === 1 ? Promise.reject(new ApiError(503, 'http_503', 'Indisponible')) : Promise.resolve(pageOf([announcementFixture()]));
      },
    });
    renderAnnouncements(<AnnouncementsListPage />, { source });

    expect(await screen.findByText('Le service est momentanément indisponible. Réessayez dans un instant.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Coupure d’eau lundi')).toBeTruthy();
  });

  it('adapte le sous-titre à l’espace mandant', async () => {
    renderAnnouncements(<AnnouncementsListPage />, { space: 'owner' });
    expect(await screen.findByText(/Les informations de votre agence : travaux, assemblées/)).toBeTruthy();
  });
});

describe('détail d’une annonce', () => {
  it('marque l’annonce lue à l’ouverture et passe le badge à « Lue »', async () => {
    const source = fakeAnnouncements();
    const { container } = renderAnnouncements(<AnnouncementDetailPage announcementId={ANNOUNCEMENT_ID} />, { source });

    expect(await screen.findByText('Non lue')).toBeTruthy();
    await waitFor(() => { expect(source.markRead).toHaveBeenCalledWith(ANNOUNCEMENT_ID); });
    expect(await screen.findByText('Lue')).toBeTruthy();
    expect(source.markRead).toHaveBeenCalledTimes(1);
    await expectNoA11yViolations(container);
  });

  it('ne rappelle pas le serveur pour une annonce déjà lue', async () => {
    const source = fakeAnnouncements({ get: () => Promise.resolve(announcementOf({ unread: false, read_at: '2026-11-19T10:00:00+00:00' })) });
    renderAnnouncements(<AnnouncementDetailPage announcementId={ANNOUNCEMENT_ID} />, { source });

    expect(await screen.findByText('Lue')).toBeTruthy();
    expect(source.markRead).not.toHaveBeenCalled();
  });

  it('rend le corps comme du texte : aucun HTML injecté', async () => {
    const hostile = '<img src=x onerror="window.pwned=1"><script>window.pwned=2</script> **gras**';
    const source = fakeAnnouncements({ get: () => Promise.resolve(announcementOf({ body: hostile, unread: false })) });
    renderAnnouncements(<AnnouncementDetailPage announcementId={ANNOUNCEMENT_ID} />, { source });

    const article = await screen.findByRole('article', { name: 'Annonce' });
    expect(article.querySelector('img')).toBeNull();
    expect(article.querySelector('script')).toBeNull();
    expect(article.querySelector('strong')).toBeNull();
    expect(article.textContent).toContain('<img src=x onerror="window.pwned=1">');
    expect(article.textContent).toContain('**gras**');
  });

  it('signale un contenu effacé sans afficher de texte', async () => {
    const source = fakeAnnouncements({ get: () => Promise.resolve(announcementOf({ content_purged: true, body: '', unread: false })) });
    renderAnnouncements(<AnnouncementDetailPage announcementId={ANNOUNCEMENT_ID} />, { source });
    expect(await screen.findByText('Contenu effacé')).toBeTruthy();
  });

  it('télécharge une pièce jointe depuis l’espace et affiche l’échec en clair', async () => {
    const user = userEvent.setup();
    const source = fakeAnnouncements({
      get: () => Promise.resolve(announcementOf({ unread: false, attachments: [{ id: ANNOUNCEMENT_ATTACHMENT_ID, name: 'avis-travaux.pdf', size_bytes: 2048 }] })),
      downloadAttachment: () => Promise.reject(new ApiError(409, 'attachment_not_ready', 'Vérification en cours')),
    });
    renderAnnouncements(<AnnouncementDetailPage announcementId={ANNOUNCEMENT_ID} />, { source });

    await user.click(await screen.findByRole('button', { name: /avis-travaux\.pdf/ }));

    expect(source.downloadAttachment).toHaveBeenCalledWith(ANNOUNCEMENT_ID, { id: ANNOUNCEMENT_ATTACHMENT_ID, name: 'avis-travaux.pdf', sizeBytes: 2048 });
    expect(await screen.findByText('Cette pièce jointe est en cours de vérification antivirus : réessayez dans quelques minutes.')).toBeTruthy();
  });

  it('propose de réessayer quand la lecture n’est pas enregistrée (429)', async () => {
    const user = userEvent.setup();
    let calls = 0;
    const source = fakeAnnouncements({
      markRead: () => {
        calls += 1;
        return calls === 1
          ? Promise.reject(new ApiError(429, 'http_429', 'Trop de requêtes', {}, 30))
          : Promise.resolve(announcementOf({ unread: false, read_at: '2026-11-19T10:00:00+00:00' }));
      },
    });
    renderAnnouncements(<AnnouncementDetailPage announcementId={ANNOUNCEMENT_ID} />, { source });

    expect(await screen.findByText('Lecture non enregistrée')).toBeTruthy();
    expect(screen.getByText('Trop de demandes en peu de temps. Patientez 30 s avant de réessayer.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Marquer comme lue' }));
    expect(await screen.findByText('Lue')).toBeTruthy();
    expect(screen.queryByText('Lecture non enregistrée')).toBeNull();
  });

  it('affiche une annonce introuvable avec le message du serveur traduit', async () => {
    const source = fakeAnnouncements({ get: () => Promise.reject(new ApiError(404, 'announcement_not_found', 'Annonce introuvable')) });
    renderAnnouncements(<AnnouncementDetailPage announcementId={ANNOUNCEMENT_ID} />, { source });
    expect(await screen.findByText('Cette annonce n’existe pas ou ne vous concerne pas.')).toBeTruthy();
    expect(source.markRead).not.toHaveBeenCalled();
  });
});
