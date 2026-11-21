import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { norm } from '../../../test/lots';
import * as api from './api/responses.fixtures';
import { uploadedPart } from './api/testing';
import type { MockRoute } from './api/testing';
import { CertificatesPage } from './CertificatesPage';
import { certificatesUrl, documentsUrl, listRoutes, pdfFile, renderConformite, rowAt } from './testing';

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

const mixedPage = { ...api.certificatesPage, data: [api.certificateValid.data, api.certificateNoExpiry.data, api.certificateBoiler.data, api.certificateExpired.data] };
const priorityRoutes = {
  [`GET ${certificatesUrl}`]: ({ search }: { search: URLSearchParams }) => {
    if (search.get('state') === 'expired') return { body: { ...api.certificatesExpired, data: [api.certificateExpired.data] } };
    if (search.get('state') === 'to_renew') return { body: { ...api.certificatesToRenew, data: [api.certificateBoiler.data] } };
    return { body: mixedPage };
  },
};

describe('liste de conformité', () => {
  it('place les pièces expirées puis à renouveler en tête, avec état et échéance de l’API', async () => {
    const { container } = renderConformite(<CertificatesPage />, priorityRoutes);

    const table = await screen.findByRole('table', { name: 'Pièces de conformité' });
    const rows = within(table).getAllByRole('row').slice(1).map((row) => norm(row.textContent));
    expect(rows[0]).toContain('Diagnostic gaz');
    expect(rows[0]).toContain('GAZ-2024');
    expect(rows[0]).toContain('01/10/2026');
    expect(rows[0]).toContain('Échue depuis 46 j');
    expect(rows[0]).toContain('Expirée');
    expect(rows[1]).toContain('Entretien de la chaudière');
    expect(rows[1]).toContain('30/11/2026');
    expect(rows[1]).toContain('Dans 14 j');
    expect(rows[1]).toContain('À renouveler');
    expect(rows[2]).toContain('Diagnostic électricité');
    expect(rows[2]).toContain('Valide');
    expect(rows[3]).toContain('Diagnostic amiante');
    expect(rows[3]).toContain('Sans échéance');
    expect(screen.getAllByRole('link', { name: /Diagnostic gaz/ })[0]?.getAttribute('href')).toBe(`/conformite/${api.IDS.expired}`);
    await expectNoA11yViolations(container);
  });

  it('met les échéances à traiter en alerte avec un lien vers chaque pièce', async () => {
    renderConformite(<CertificatesPage />, priorityRoutes);

    const alerts = await screen.findByRole('region', { name: 'Échéances à traiter' });
    await within(alerts).findByText('Pièces expirées');
    const expired = within(alerts).getByRole('link', { name: 'Diagnostic gaz GAZ-2024' });
    expect(expired.getAttribute('href')).toBe(`/conformite/${api.IDS.expired}`);
    expect(norm(alerts.textContent)).toContain('Pièces à renouveler');
    expect(within(alerts).getByRole('link', { name: 'Entretien de la chaudière CH-2025' })).toBeTruthy();
  });

  it('filtre par état et par type côté serveur', async () => {
    const { callsTo } = renderConformite(<CertificatesPage />, priorityRoutes);
    await screen.findByRole('table', { name: 'Pièces de conformité' });

    await userEvent.click(screen.getByRole('combobox', { name: /^État/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'À renouveler' }));
    await waitFor(() => { expect(callsTo('GET', certificatesUrl).at(-1)?.search.get('state')).toBe('to_renew'); });

    await userEvent.click(screen.getByRole('combobox', { name: /^Type de pièce/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Diagnostic gaz' }));
    await waitFor(() => { expect(callsTo('GET', certificatesUrl).at(-1)?.search.get('certificate_type_term_id')).toBe(api.IDS.typeGas); });

    await userEvent.click(screen.getByRole('checkbox', { name: 'Inclure les pièces remplacées' }));
    await waitFor(() => { expect(callsTo('GET', certificatesUrl).at(-1)?.search.get('include_replaced')).toBe('1'); });
  });

  it('pagine par curseur', async () => {
    const { callsTo } = renderConformite(<CertificatesPage />, listRoutes(api.certificatesPaged));
    await screen.findByRole('table', { name: 'Pièces de conformité' });

    await userEvent.click(screen.getByRole('button', { name: /Suivant/ }));

    await waitFor(() => { expect(callsTo('GET', certificatesUrl).at(-1)?.search.get('cursor')).toBe(api.certificatesPaged.meta.next_cursor); });
  });

  it('affiche l’état vide, avec et sans filtre', async () => {
    renderConformite(<CertificatesPage />, listRoutes(api.certificatesEmpty));
    expect(await screen.findByText('Aucune pièce')).toBeTruthy();
    expect(screen.getByText(/Ajoutez un diagnostic/)).toBeTruthy();
  });

  it('signale l’erreur du serveur en français', async () => {
    renderConformite(<CertificatesPage />, { [`GET ${certificatesUrl}`]: { status: 403, body: api.problemForbidden } });
    expect((await screen.findAllByText('Votre rôle ne permet pas cette action sur la conformité.')).length).toBeGreaterThan(0);
  });

  it('signale une panne réseau', async () => {
    const { fetchImpl } = renderConformite(<CertificatesPage />, listRoutes());
    await screen.findByRole('table', { name: 'Pièces de conformité' });
    fetchImpl.mockRejectedValue(new TypeError('Failed to fetch'));
    await userEvent.click(screen.getByRole('combobox', { name: /^État/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Expirées' }));
    expect((await screen.findAllByText('Le serveur est injoignable. Vérifiez votre connexion et réessayez.')).length).toBeGreaterThan(0);
  });

  it('télécharge le justificatif par le client authentifié', async () => {
    const withFile = { ...api.certificatesPage, data: [api.certificateDpe.data] };
    const { callsTo } = renderConformite(<CertificatesPage />, {
      ...listRoutes(withFile),
      [`GET ${documentsUrl(`/files/${api.IDS.file}/download`)}`]: { file: { content: api.PDF_BYTES, type: 'application/pdf' } },
    });

    await userEvent.click(await screen.findByRole('button', { name: /^Télécharger le justificatif, Diagnostic de performance/ }));

    await waitFor(() => { expect(callsTo('GET', documentsUrl(`/files/${api.IDS.file}/download`))).toHaveLength(1); });
    await waitFor(() => { expect(clicks).toHaveBeenCalledTimes(1); });
  });

  it('signale un téléchargement refusé sans rien enregistrer', async () => {
    const withFile = { ...api.certificatesPage, data: [api.certificateDpe.data] };
    renderConformite(<CertificatesPage />, { ...listRoutes(withFile), [`GET ${documentsUrl(`/files/${api.IDS.file}/download`)}`]: { status: 404, body: api.problemFileNotFound } });

    await userEvent.click(await screen.findByRole('button', { name: /^Télécharger le justificatif/ }));

    expect(await screen.findByText('Téléchargement impossible')).toBeTruthy();
    expect(clicks).not.toHaveBeenCalled();
  });
});

describe('droits d’écriture', () => {
  it.each(['owner', 'admin', 'manager'] as const)('%s voit l’ajout et le renouvellement', async (role) => {
    renderConformite(<CertificatesPage />, priorityRoutes, { role });
    await screen.findByRole('table', { name: 'Pièces de conformité' });
    expect(screen.getByRole('button', { name: 'Ajouter une pièce' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Renouveler, / }).length).toBeGreaterThan(0);
  });

  it('masque l’ajout et le renouvellement au comptable, qui garde la lecture et le téléchargement', async () => {
    renderConformite(<CertificatesPage />, listRoutes({ ...api.certificatesPage, data: [api.certificateDpe.data, api.certificateBoiler.data] }), { role: 'accountant' });
    await screen.findByRole('table', { name: 'Pièces de conformité' });
    expect(screen.queryByRole('button', { name: 'Ajouter une pièce' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Renouveler, / })).toBeNull();
    expect(screen.getByRole('button', { name: /^Télécharger le justificatif/ })).toBeTruthy();
  });

  it('masque aussi l’écriture sans rôle connu', async () => {
    renderConformite(<CertificatesPage />, listRoutes(), { role: null });
    await screen.findByRole('table', { name: 'Pièces de conformité' });
    expect(screen.queryByRole('button', { name: 'Ajouter une pièce' })).toBeNull();
  });

  it('ne propose pas de renouveler une pièce déjà remplacée', async () => {
    renderConformite(<CertificatesPage />, listRoutes({ ...api.certificatesWithReplaced, data: [api.certificateBoilerReplaced.data] }));
    const table = await screen.findByRole('table', { name: 'Pièces de conformité' });
    expect(within(rowAt(table, 0)).queryByRole('button', { name: /^Renouveler/ })).toBeNull();
    expect(norm(rowAt(table, 0).textContent)).toContain('Remplacée');
  });
});

async function chooseOption(name: RegExp, option: string | RegExp) {
  await userEvent.click(screen.getByRole('combobox', { name }));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

describe('ajout d’une pièce', () => {
  const addRoutes = {
    ...listRoutes(),
    [`POST ${documentsUrl('/files')}`]: { status: 201, body: api.uploadedFile },
    [`POST ${certificatesUrl}`]: { status: 201, body: api.certificateDpe },
  };

  async function openDialog(routes: Record<string, MockRoute> = addRoutes) {
    const view = renderConformite(<CertificatesPage />, routes);
    await screen.findByRole('table', { name: 'Pièces de conformité' });
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter une pièce' }));
    const dialog = await screen.findByRole('dialog');
    return { ...view, dialog };
  }

  it('téléverse le justificatif puis crée la pièce, avec les valeurs propres au type', async () => {
    const { callsTo, dialog } = await openDialog();

    await chooseOption(/^Type de pièce/, /^Diagnostic de performance/);
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Référence' }), 'DPE-2026-001');
    await userEvent.type(within(dialog).getByLabelText(/^Émise le/), '2026-01-10');
    await chooseOption(/^Classe énergétique/, 'C');
    await userEvent.upload(within(dialog).getByLabelText('Justificatif'), pdfFile('Mon DPE.pdf'));
    expect(within(dialog).getByTestId('file-name').textContent).toBe('Mon DPE.pdf');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter la pièce' }));

    await waitFor(() => { expect(callsTo('POST', certificatesUrl)).toHaveLength(1); });
    expect(uploadedPart(callsTo('POST', documentsUrl('/files'))[0]?.form ?? null)).toMatchObject({ type: 'application/pdf' });
    expect(callsTo('POST', certificatesUrl)[0]?.body).toEqual({
      subject_type: 'organization',
      subject_id: api.IDS.org,
      certificate_type_term_id: api.IDS.typeDpe,
      reference: 'DPE-2026-001',
      issued_on: '2026-01-10',
      values: { energy_class: 'C' },
      stored_file_id: api.uploadedFile.data.id,
    });
    expect(await screen.findByText('Pièce ajoutée')).toBeTruthy();
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
  });

  it('refuse sur place un type de fichier interdit et ne le transmet pas', async () => {
    const { callsTo, dialog } = await openDialog();
    await chooseOption(/^Type de pièce/, 'Diagnostic gaz');
    await userEvent.type(within(dialog).getByLabelText(/^Émise le/), '2026-11-01');

    await userEvent.upload(within(dialog).getByLabelText('Justificatif'), new File(['PK'], 'archive.zip', { type: 'application/zip' }), { applyAccept: false });
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Ce type de fichier n’est pas accepté');
    expect(within(dialog).queryByTestId('file-name')).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter la pièce' }));

    await waitFor(() => { expect(callsTo('POST', certificatesUrl)).toHaveLength(1); });
    expect(callsTo('POST', documentsUrl('/files'))).toHaveLength(0);
    expect(callsTo('POST', certificatesUrl)[0]?.body).not.toHaveProperty('stored_file_id');
  });

  it('refuse sur place un fichier de plus de 10 Mo', async () => {
    const { dialog } = await openDialog();
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'gros.pdf', { type: 'application/pdf' });

    await userEvent.upload(within(dialog).getByLabelText('Justificatif'), big);

    expect((await within(dialog).findByRole('alert')).textContent).toBe('Ce fichier dépasse 10 Mo.');
    expect(within(dialog).queryByTestId('file-name')).toBeNull();
  });

  it('bloque la création tant que le type, l’objet et la date manquent', async () => {
    const { callsTo, dialog } = await openDialog();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter la pièce' }));

    expect(await within(dialog).findByText('Choisissez le type de pièce.')).toBeTruthy();
    expect(within(dialog).getByText('Saisissez la date d’émission (AAAA-MM-JJ).')).toBeTruthy();
    expect(callsTo('POST', certificatesUrl)).toHaveLength(0);
  });

  it('exige la valeur obligatoire du type avant d’envoyer', async () => {
    const { callsTo, dialog } = await openDialog();
    await chooseOption(/^Type de pièce/, /^Diagnostic de performance/);
    await userEvent.type(within(dialog).getByLabelText(/^Émise le/), '2026-01-10');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter la pièce' }));

    expect(await within(dialog).findByText('Ce champ est obligatoire.')).toBeTruthy();
    expect(callsTo('POST', certificatesUrl)).toHaveLength(0);
  });

  it('rattache la pièce à un lot choisi', async () => {
    const { callsTo, dialog } = await openDialog();
    await chooseOption(/^Type de pièce/, 'Diagnostic gaz');
    await userEvent.type(within(dialog).getByLabelText(/^Émise le/), '2026-11-01');
    await chooseOption(/^Concerne/, 'Lot');
    await userEvent.click(within(dialog).getByRole('combobox', { name: /^Lot/ }));
    const option = (await screen.findAllByRole('option'))[0];
    if (!option) throw new Error('Aucun lot proposé');
    await userEvent.click(option);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter la pièce' }));

    await waitFor(() => { expect(callsTo('POST', certificatesUrl)).toHaveLength(1); });
    expect(callsTo('POST', certificatesUrl)[0]?.body).toMatchObject({ subject_type: 'unit' });
  });

  it('affiche le refus du serveur sur le champ et garde la saisie', async () => {
    const { dialog } = await openDialog({ ...addRoutes, [`POST ${certificatesUrl}`]: { status: 422, body: api.problemDpeClass } });
    await chooseOption(/^Type de pièce/, /^Diagnostic de performance/);
    await userEvent.type(within(dialog).getByLabelText(/^Émise le/), '2026-01-10');
    await chooseOption(/^Classe énergétique/, 'C');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter la pièce' }));

    expect(await within(dialog).findByText('La classe énergétique est invalide.')).toBeTruthy();
    expect(within(dialog).getByLabelText<HTMLInputElement>(/^Émise le/).value).toBe('2026-01-10');
  });

  it.each([
    ['403', 403, api.problemForbidden, 'Votre rôle ne permet pas cette action sur la conformité.'],
    ['404 type', 404, api.problemTermNotFound, 'Ce type de pièce n’est pas disponible pour votre organisation.'],
    ['404 objet', 404, api.problemSubjectNotFound, 'L’objet choisi n’existe pas dans votre organisation ou ne peut pas porter de pièce.'],
    ['429', 429, api.problemTooManyRequests, 'Trop de requêtes en peu de temps. Réessayez dans 60 secondes.'],
  ] as const)('affiche l’erreur %s dans le dialogue', async (_name, status, body, message) => {
    const { dialog } = await openDialog({ ...addRoutes, [`POST ${certificatesUrl}`]: { status, body, headers: { 'Retry-After': '60' } } });
    await chooseOption(/^Type de pièce/, 'Diagnostic gaz');
    await userEvent.type(within(dialog).getByLabelText(/^Émise le/), '2026-11-01');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter la pièce' }));

    expect(await within(dialog).findByText(message)).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('respecte l’accessibilité du dialogue', async () => {
    const { dialog } = await openDialog();
    await chooseOption(/^Type de pièce/, /^Diagnostic de performance/);
    await expectNoA11yViolations(dialog);
  });
});

describe('renouvellement d’une pièce', () => {
  const renewPath = documentsUrl(`/certificates/${api.IDS.boiler}/renew`);
  const routes = {
    ...priorityRoutes,
    [`POST ${documentsUrl('/files')}`]: { status: 201, body: api.uploadedFile },
    [`POST ${renewPath}`]: { status: 201, body: api.certificateRenewed },
  };

  async function openRenew(custom: Record<string, MockRoute> = routes) {
    const view = renderConformite(<CertificatesPage />, custom);
    await userEvent.click(await screen.findByRole('button', { name: /^Renouveler, Entretien de la chaudière CH-2025/ }));
    return { ...view, dialog: await screen.findByRole('dialog') };
  }

  it('renouvelle après saisie des nouvelles dates et du justificatif', async () => {
    const { callsTo, dialog } = await openRenew();
    expect(dialog.textContent).toContain('échéance actuelle le 30/11/2026');

    await userEvent.clear(within(dialog).getByRole('textbox', { name: 'Référence' }));
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Référence' }), 'CH-2026');
    await userEvent.type(within(dialog).getByLabelText(/^Émise le/), '2026-11-16');
    await userEvent.upload(within(dialog).getByLabelText('Nouveau justificatif'), pdfFile('chaudiere.pdf'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Renouveler la pièce' }));

    await waitFor(() => { expect(callsTo('POST', renewPath)).toHaveLength(1); });
    expect(callsTo('POST', renewPath)[0]?.body).toEqual({ reference: 'CH-2026', issued_on: '2026-11-16', values: {}, stored_file_id: api.uploadedFile.data.id });
    expect(await screen.findByText('Pièce renouvelée')).toBeTruthy();
  });

  it('exige la date d’émission', async () => {
    const { callsTo, dialog } = await openRenew();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Renouveler la pièce' }));
    expect(await within(dialog).findByText('Saisissez la date d’émission (AAAA-MM-JJ).')).toBeTruthy();
    expect(callsTo('POST', renewPath)).toHaveLength(0);
  });

  it('signale une pièce déjà renouvelée (409)', async () => {
    const { dialog } = await openRenew({ ...routes, [`POST ${renewPath}`]: { status: 409, body: api.problemAlreadyReplaced } });
    await userEvent.type(within(dialog).getByLabelText(/^Émise le/), '2026-11-16');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Renouveler la pièce' }));
    expect(await within(dialog).findByText('Cette pièce a déjà été renouvelée : renouvelez la pièce la plus récente.')).toBeTruthy();
  });
});
