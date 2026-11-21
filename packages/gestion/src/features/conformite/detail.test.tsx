import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { norm } from '../../../test/lots';
import * as api from './api/responses.fixtures';
import { CertificateDetailPage } from './CertificateDetailPage';
import { DocumentsPage } from './DocumentsPage';
import { certificatesUrl, documentsUrl, listRoutes, renderConformite } from './testing';

let clicks: MockInstance<() => void>;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-16T10:00:00Z'));
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:file'), revokeObjectURL: vi.fn() }));
  clicks = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});
afterEach(() => {
  clicks.mockRestore();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const certificatePath = (id: string) => documentsUrl(`/certificates/${id}`);
const downloadPath = documentsUrl(`/files/${api.IDS.file}/download`);

describe('détail d’une pièce', () => {
  it('affiche l’état, les dates, les valeurs du type et le justificatif', async () => {
    const { container } = renderConformite(<CertificateDetailPage id={api.IDS.dpe} />, { [`GET ${certificatePath(api.IDS.dpe)}`]: { body: api.certificateDpe } });

    expect(await screen.findByRole('heading', { level: 1, name: 'Diagnostic de performance énergétique (DPE), DPE-2026-001' })).toBeTruthy();
    const info = norm(screen.getByText('Informations').closest('div')?.parentElement?.textContent);
    expect(info).toContain('Émise le10/01/2026');
    expect(info).toContain('Échéance10/01/2036');
    expect(info).toContain('Classe énergétiqueC');
    expect(info).toContain('JustificatifFichier joint');
    expect(info).toContain('ConcerneOrganisation');
    expect(screen.getByText('Valide')).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('alerte sur une pièce expirée et propose de la renouveler', async () => {
    renderConformite(<CertificateDetailPage id={api.IDS.expired} />, { [`GET ${certificatePath(api.IDS.expired)}`]: { body: api.certificateExpired } });
    expect(await screen.findByText('Pièce expirée')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Renouveler' })).toBeTruthy();
    expect(screen.getByText('Expirée')).toBeTruthy();
  });

  it('signale une pièce à renouveler avec le délai restant', async () => {
    renderConformite(<CertificateDetailPage id={api.IDS.boiler} />, { [`GET ${certificatePath(api.IDS.boiler)}`]: { body: api.certificateBoiler } });
    expect(await screen.findByText('Pièce à renouveler')).toBeTruthy();
    expect(screen.getByText(/dans 14 j/)).toBeTruthy();
  });

  it('renvoie vers la pièce à jour et masque le renouvellement d’une pièce remplacée', async () => {
    renderConformite(<CertificateDetailPage id={api.IDS.boiler} />, { [`GET ${certificatePath(api.IDS.boiler)}`]: { body: api.certificateBoilerReplaced } });
    expect(await screen.findByText('Pièce renouvelée')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Voir la pièce à jour' }).getAttribute('href')).toBe(`/conformite/${api.IDS.renewed}`);
    expect(screen.queryByRole('button', { name: 'Renouveler' })).toBeNull();
  });

  it('renvoie vers la pièce remplacée dans l’historique', async () => {
    renderConformite(<CertificateDetailPage id={api.IDS.renewed} />, { [`GET ${certificatePath(api.IDS.renewed)}`]: { body: api.certificateRenewed } });
    expect((await screen.findByRole('link', { name: 'Voir la pièce remplacée' })).getAttribute('href')).toBe(`/conformite/${api.IDS.boiler}`);
  });

  it('masque le renouvellement au comptable', async () => {
    renderConformite(<CertificateDetailPage id={api.IDS.expired} />, { [`GET ${certificatePath(api.IDS.expired)}`]: { body: api.certificateExpired } }, { role: 'accountant' });
    await screen.findByText('Pièce expirée');
    expect(screen.queryByRole('button', { name: 'Renouveler' })).toBeNull();
  });

  it('télécharge le justificatif', async () => {
    const { callsTo } = renderConformite(<CertificateDetailPage id={api.IDS.dpe} />, {
      [`GET ${certificatePath(api.IDS.dpe)}`]: { body: api.certificateDpe },
      [`GET ${downloadPath}`]: { file: { content: api.PDF_BYTES, type: 'application/pdf' } },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Télécharger le justificatif' }));
    await waitFor(() => { expect(callsTo('GET', downloadPath)).toHaveLength(1); });
    await waitFor(() => { expect(clicks).toHaveBeenCalledTimes(1); });
  });

  it('renouvelle depuis le détail', async () => {
    const renewPath = documentsUrl(`/certificates/${api.IDS.expired}/renew`);
    const { callsTo } = renderConformite(<CertificateDetailPage id={api.IDS.expired} />, {
      [`GET ${certificatePath(api.IDS.expired)}`]: { body: api.certificateExpired },
      [`POST ${renewPath}`]: { status: 201, body: api.certificateRenewed },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Renouveler' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/^Émise le/), '2026-11-16');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Renouveler la pièce' }));
    await waitFor(() => { expect(callsTo('POST', renewPath)).toHaveLength(1); });
  });

  it('signale une pièce introuvable (404)', async () => {
    renderConformite(<CertificateDetailPage id={api.IDS.dpe} />, { [`GET ${certificatePath(api.IDS.dpe)}`]: { status: 404, body: api.problemCertificateNotFound } });
    expect(await screen.findByText('Cette pièce n’existe pas')).toBeTruthy();
  });

  it('signale une erreur de chargement', async () => {
    renderConformite(<CertificateDetailPage id={api.IDS.dpe} />, { [`GET ${certificatePath(api.IDS.dpe)}`]: { status: 429, body: api.problemTooManyRequests } });
    expect(await screen.findByText(/Trop de requêtes en peu de temps/)).toBeTruthy();
  });
});

describe('documents', () => {
  const withFiles = { ...api.certificatesPage, data: [api.certificateDpe.data, api.certificateBoiler.data] };

  it('ne liste que les justificatifs réellement joints à une pièce', async () => {
    const { container, callsTo } = renderConformite(<DocumentsPage />, listRoutes(withFiles));

    const table = await screen.findByRole('table', { name: 'Justificatifs de conformité' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(norm(rows[0]?.textContent)).toContain('Diagnostic de performance énergétique (DPE) DPE-2026-001');
    expect(norm(rows[0]?.textContent)).toContain('Valide');
    expect(Object.fromEntries(callsTo('GET', certificatesUrl)[0]?.search ?? [])).toEqual({ per_page: '100', include_replaced: '1' });
    await expectNoA11yViolations(container);
  });

  it('explique ce qui reste « Bientôt disponible »', async () => {
    renderConformite(<DocumentsPage />, listRoutes(withFiles));
    expect(await screen.findByText('Seuls les justificatifs de conformité sont disponibles pour l’instant')).toBeTruthy();
    expect(screen.getByText(/partage avec les locataires et l’archivage/)).toBeTruthy();
  });

  it('télécharge un justificatif', async () => {
    const { callsTo } = renderConformite(<DocumentsPage />, { ...listRoutes(withFiles), [`GET ${downloadPath}`]: { file: { content: api.PDF_BYTES, type: 'application/pdf' } } });
    await userEvent.click(await screen.findByRole('button', { name: /^Télécharger le justificatif, Diagnostic de performance/ }));
    await waitFor(() => { expect(callsTo('GET', downloadPath)).toHaveLength(1); });
  });

  it('affiche l’état vide sans justificatif', async () => {
    renderConformite(<DocumentsPage />, listRoutes({ ...api.certificatesPage, data: [api.certificateBoiler.data] }));
    expect(await screen.findByText('Aucun document')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ajouter une pièce' })).toBeTruthy();
  });

  it('masque l’invitation à ajouter une pièce au comptable', async () => {
    renderConformite(<DocumentsPage />, listRoutes(api.certificatesEmpty), { role: 'accountant' });
    await screen.findByText('Aucun document');
    expect(screen.queryByRole('link', { name: 'Ajouter une pièce' })).toBeNull();
  });

  it('signale l’erreur du serveur', async () => {
    renderConformite(<DocumentsPage />, { [`GET ${certificatesUrl}`]: { status: 403, body: api.problemForbidden } });
    expect(await screen.findByText('Votre rôle ne permet pas cette action sur la conformité.')).toBeTruthy();
  });
});
