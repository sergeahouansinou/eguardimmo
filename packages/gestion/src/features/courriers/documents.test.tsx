import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { FROZEN_NOW, at, norm, renderLot } from '../../../test/lots';
import { AttestationApercuPage } from './AttestationApercuPage';
import { AvisEcheanceApercuPage } from './AvisEcheanceApercuPage';
import { AvisEcheancePage } from './AvisEcheancePage';
import { QuittanceApercuPage } from './QuittanceApercuPage';
import { QuittancesPage } from './QuittancesPage';
import { SignatureNewPage } from './SignatureNewPage';
import { SignaturesPage } from './SignaturesPage';
import type { Notice, Receipt, Signature } from './schemas';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN_NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const dataRows = (table: HTMLElement) => within(table).getAllByRole('row').slice(1);
const receiptsOf = async (source: { receipts: () => Promise<unknown> }) => (await source.receipts()) as Receipt[];
const noticesOf = async (source: { notices: () => Promise<unknown> }) => (await source.notices()) as Notice[];
const signaturesOf = async (source: { signatures: () => Promise<unknown> }) => (await source.signatures()) as Signature[];

describe('QuittancesPage', () => {
  it('liste les quittances émises, paginées, et celles à émettre', async () => {
    const { container } = renderLot(<QuittancesPage />);
    const table = await screen.findByRole('table', { name: 'Quittances' });
    expect(dataRows(table)).toHaveLength(10);
    expect(screen.getByRole('tab', { name: /Émises/ }).textContent).toContain('36');
    expect(screen.getByRole('tab', { name: /À émettre/ }).textContent).toContain('6');
    await expectNoA11yViolations(container);
  });

  it('filtre par mois', async () => {
    renderLot(<QuittancesPage />);
    await screen.findByRole('table', { name: 'Quittances' });
    await userEvent.click(screen.getByRole('combobox', { name: /^Mois/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Octobre 2026' }));
    expect(dataRows(screen.getByRole('table', { name: 'Quittances' }))).toHaveLength(9);
  });

  it('affiche le panneau de détail d’une quittance et envoie la quittance', async () => {
    const { sources } = renderLot(<QuittancesPage />);
    await screen.findByRole('table', { name: 'Quittances' });
    await userEvent.click(at(screen.getAllByRole('button', { name: 'Détail' }), 0));
    const panel = await screen.findByRole('region', { name: 'Détail de la quittance' });
    expect(within(panel).getByRole('link', { name: /Aperçu et PDF/ })).toBeTruthy();
    await userEvent.click(within(panel).getByRole('button', { name: 'Envoyer par e-mail' }));
    await waitFor(async () => {
      expect((await receiptsOf(sources.courriers)).filter((item) => item.sentOn === '2026-11-13').length).toBe(1);
    });
  });

  it('émet les quittances soldées de novembre avec des numéros continus', async () => {
    const { sources } = renderLot(<QuittancesPage />);
    await userEvent.click(await screen.findByRole('tab', { name: /À émettre/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Émettre les quittances soldées' }));
    const dialog = await screen.findByRole('dialog');
    expect(norm(dialog.textContent)).toContain('6 quittances de Novembre 2026');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Émettre les quittances' }));
    await waitFor(async () => {
      const receipts = await receiptsOf(sources.courriers);
      expect(receipts.filter((item) => item.number === null)).toHaveLength(0);
      const numbers = receipts.filter((item) => item.month === '2026-11').map((item) => item.number).sort();
      expect(numbers).toEqual(['QT-2026-0413', 'QT-2026-0414', 'QT-2026-0415', 'QT-2026-0416', 'QT-2026-0417', 'QT-2026-0418']);
    });
  });
});

describe('QuittanceApercuPage', () => {
  it('rend la quittance d’octobre de Koffi Adjovi et imprime', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const { container } = renderLot(<QuittanceApercuPage id="qt-2026-0398" />);
    const paper = await screen.findByRole('article', { name: 'Quittance de loyer QT-2026-0398' });
    expect(norm(paper.textContent)).toContain('850 €');
    expect(norm(paper.textContent)).toContain('octobre 2026');
    await userEvent.click(screen.getByRole('button', { name: 'Télécharger en PDF' }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Enregistrer en PDF')).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('refuse une quittance non émise', async () => {
    renderLot(<QuittanceApercuPage id="en-attente-202611-apt-a3" />);
    expect(await screen.findByText('Elle n’existe pas ou n’a pas encore été émise.')).toBeTruthy();
  });
});

describe('AvisEcheancePage', () => {
  it('liste les avis de décembre à envoyer', async () => {
    const { container } = renderLot(<AvisEcheancePage />);
    const table = await screen.findByRole('table', { name: 'Avis d’échéance' });
    expect(dataRows(table)).toHaveLength(9);
    expect(screen.getByRole('tab', { name: /Envoyés/ }).textContent).toContain('9');
    await expectNoA11yViolations(container);
  });

  it('envoie un avis puis tous les avis restants après confirmation', async () => {
    const { sources } = renderLot(<AvisEcheancePage />);
    await screen.findByRole('table', { name: 'Avis d’échéance' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, avis de Koffi Adjovi, Décembre 2026' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Envoyer à ce locataire' }));
    await waitFor(async () => {
      expect((await noticesOf(sources.courriers)).find((item) => item.id === 'av-20261201-apt-a1')?.sentOn).toBe('2026-11-13');
    });
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer les avis' }));
    const dialog = await screen.findByRole('dialog');
    expect(norm(dialog.textContent)).toContain('8 avis seront envoyés');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Envoyer les avis' }));
    await waitFor(async () => {
      expect((await noticesOf(sources.courriers)).filter((item) => item.sentOn === null)).toHaveLength(0);
    });
  });

  it('affiche l’aperçu de l’avis de Koffi Adjovi avec le reliquat', async () => {
    const { container } = renderLot(<AvisEcheanceApercuPage id="av-20261201-apt-a1" />);
    const paper = await screen.findByRole('article', { name: /Avis d’échéance Koffi Adjovi, Décembre 2026/ });
    expect(norm(paper.textContent)).toContain('Reliquat des mois précédents850 €');
    expect(norm(paper.textContent)).toContain('Total à régler1 700 €');
    await expectNoA11yViolations(container);
  });
});

describe('AttestationApercuPage', () => {
  it('rend l’attestation de restitution avec le décompte', async () => {
    const { container } = renderLot(<AttestationApercuPage id="at-2023-0018" />);
    const paper = await screen.findByRole('article', { name: 'Attestation de restitution AT-2023-0018' });
    expect(norm(paper.textContent)).toContain('Dépôt de garantie versé690 €');
    expect(norm(paper.textContent)).toContain('576 €');
    expect(norm(paper.textContent)).toContain('Sarah Mensah');
    await expectNoA11yViolations(container);
  });

  it('signale une attestation introuvable', async () => {
    renderLot(<AttestationApercuPage id="inconnue" />);
    expect(await screen.findByText('Elle n’existe pas ou le lien est incorrect.')).toBeTruthy();
  });
});

describe('SignaturesPage', () => {
  it('liste les demandes en attente et affiche les signataires', async () => {
    const { container } = renderLot(<SignaturesPage />);
    const table = await screen.findByRole('table', { name: 'Demandes de signature' });
    expect(dataRows(table)).toHaveLength(1);
    expect(norm(table.textContent)).toContain('1 sur 2 ont signé');
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, SG-2026-0012' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Voir les signataires' }));
    const dialog = await screen.findByRole('dialog');
    expect(norm(dialog.textContent)).toContain('Yann Le Gall');
    expect(norm(dialog.textContent)).toContain('A signé');
    await expectNoA11yViolations(container);
  });

  it('annule une demande après confirmation', async () => {
    const { sources } = renderLot(<SignaturesPage />);
    await screen.findByRole('table', { name: 'Demandes de signature' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, SG-2026-0012' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Annuler la demande' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Annuler la demande' }));
    await waitFor(async () => {
      expect((await signaturesOf(sources.courriers)).find((item) => item.id === 'sg-2026-0012')?.status).toBe('annule');
    });
  });
});

describe('SignatureNewPage', () => {
  it('bloque l’étape 1 sans titre ni fichier', async () => {
    renderLot(<SignatureNewPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Suivant' }));
    expect(await screen.findByText('Donnez un titre au document')).toBeTruthy();
    expect(screen.getByText('Joignez le PDF à signer', { selector: '[role="alert"]' })).toBeTruthy();
  });

  it('refuse un fichier qui n’est pas un PDF', async () => {
    renderLot(<SignatureNewPage />);
    const input = await screen.findByLabelText('Joindre le PDF à signer');
    await userEvent.upload(input, new File(['x'], 'photo.png', { type: 'image/png' }), { applyAccept: false });
    expect(await screen.findByText('Ce type de fichier n’est pas accepté.')).toBeTruthy();
  });

  it('crée la demande en trois étapes', async () => {
    const { sources, push } = renderLot(<SignatureNewPage />);
    await userEvent.type(await screen.findByLabelText('Titre du document *'), 'Avenant Apt A2');
    await userEvent.upload(screen.getByLabelText('Joindre le PDF à signer'), new File(['%PDF'], 'avenant.pdf', { type: 'application/pdf' }));
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(await screen.findByText('Chaque signataire a besoin d’un nom et d’un e-mail valide')).toBeTruthy();
    await userEvent.type(screen.getByLabelText('Nom du signataire 1'), 'Nadège Sossou');
    await userEvent.type(screen.getByLabelText('E-mail du signataire 1'), 'nadege.sossou@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(await screen.findByRole('heading', { name: 'Étape 3, Placement' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer pour signature' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/documents/signatures'); });
    expect((await signaturesOf(sources.courriers)).find((item) => item.id === 'sg-2026-0013')).toMatchObject({
      title: 'Avenant Apt A2',
      fileName: 'avenant.pdf',
      status: 'en_cours',
      signers: [{ name: 'Nadège Sossou', email: 'nadege.sossou@example.com', status: 'attente' }],
    });
  });
});
