import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { FROZEN_NOW, renderLot } from '../../../test/lots';
import { CourrierFormPage } from './CourrierFormPage';
import { CourriersPage } from './CourriersPage';
import { SignatureNewPage } from './SignatureNewPage';
import { SignaturesPage } from './SignaturesPage';
import type { Courrier, Signature } from './schemas';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN_NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const courriersOf = async (source: { courriers: () => Promise<unknown> }) => (await source.courriers()) as Courrier[];
const signaturesOf = async (source: { signatures: () => Promise<unknown> }) => (await source.signatures()) as Signature[];

async function choose(label: RegExp, option: string) {
  await userEvent.click(screen.getByRole('combobox', { name: label }));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

describe('SignatureNewPage, placement des signatures', () => {
  const reachPlacement = async () => {
    await userEvent.type(await screen.findByLabelText('Titre du document *'), 'Avenant Apt A2');
    await userEvent.upload(screen.getByLabelText('Joindre le PDF à signer'), new File(['%PDF'], 'avenant.pdf', { type: 'application/pdf' }));
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    await userEvent.type(screen.getByLabelText('Nom du signataire 1'), 'Nadège Sossou');
    await userEvent.type(screen.getByLabelText('E-mail du signataire 1'), 'nadege.sossou@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter un signataire' }));
    await userEvent.type(screen.getByLabelText('Nom du signataire 2'), 'Marc Dossou');
    await userEvent.type(screen.getByLabelText('E-mail du signataire 2'), 'marc.dossou@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(await screen.findByRole('heading', { name: 'Étape 3, Placement' })).toBeTruthy();
  };

  it('envoie la demande avec un champ par signataire, positionné par l’utilisateur', async () => {
    const { sources, push, container } = renderLot(<SignatureNewPage />);
    await reachPlacement();
    await expectNoA11yViolations(container);
    await choose(/^Signataire/, '2. Marc Dossou');
    await choose(/^Page du champ/, 'Page 2 sur 3');
    await choose(/^Position horizontale/, 'À gauche');
    await choose(/^Position verticale/, 'En haut');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer pour signature' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/documents/signatures'); });
    const created = (await signaturesOf(sources.courriers)).find((item) => item.id === 'sg-2026-0013');
    expect(created?.signers).toHaveLength(2);
    expect(created?.fields).toEqual([{ signer: 0, page: 3, x: 20, y: 85 }, { signer: 1, page: 2, x: 20, y: 15 }]);
  });

  it('place un champ par défaut pour chaque signataire sans intervention', async () => {
    const { sources } = renderLot(<SignatureNewPage />);
    await reachPlacement();
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer pour signature' }));
    await waitFor(async () => { expect((await signaturesOf(sources.courriers)).some((item) => item.id === 'sg-2026-0013')).toBe(true); });
    const created = (await signaturesOf(sources.courriers)).find((item) => item.id === 'sg-2026-0013');
    expect(created?.fields.map((field) => field.signer)).toEqual([0, 1]);
  });

  it('préremplit le titre et le fichier depuis l’adresse', async () => {
    renderLot(<SignatureNewPage />, { search: 'titre=Courrier%20de%20r%C3%A9vision&fichier=CR-2026-0038.pdf' });
    expect(await screen.findByDisplayValue('Courrier de révision')).toBeTruthy();
    expect(screen.getByText(/CR-2026-0038\.pdf/)).toBeTruthy();
  });

  it('refuse côté source un champ qui désigne un signataire inconnu', () => {
    const { sources } = renderLot(<SignatureNewPage />);
    expect(() => sources.courriers.createSignature({ title: 'X', fileName: 'x.pdf', signers: [{ name: 'A B', email: 'a@example.com' }], fields: [{ signer: 3, page: 1, x: 10, y: 10 }] })).toThrow('Un champ de signature désigne un signataire inconnu');
  });
});

describe('SignaturesPage, menu', () => {
  const open = async (reference: string, item: string) => {
    await screen.findByRole('table', { name: 'Demandes de signature' });
    await userEvent.click(screen.getByRole('button', { name: `Plus d’actions, ${reference}` }));
    await userEvent.click(await screen.findByRole('menuitem', { name: item }));
  };

  it('relance les signataires d’une demande en cours et affiche la date', async () => {
    const { sources } = renderLot(<SignaturesPage />);
    await open('SG-2026-0012', 'Relancer les signataires');
    await waitFor(async () => { expect((await signaturesOf(sources.courriers)).find((item) => item.id === 'sg-2026-0012')?.reminderSentOn).toBe('2026-11-13'); });
    expect(await screen.findByText('Relancé le 13/11/2026')).toBeTruthy();
  });

  it('désactive la relance d’une demande signée et le certificat d’une demande en cours', async () => {
    renderLot(<SignaturesPage />);
    await userEvent.click(await screen.findByRole('tab', { name: /Signés/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Plus d’actions, SG-2026-0011' }));
    expect((await screen.findByRole('menuitem', { name: 'Relancer les signataires' })).getAttribute('aria-disabled')).toBe('true');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('tab', { name: /En attente/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Plus d’actions, SG-2026-0012' }));
    expect((await screen.findByRole('menuitem', { name: 'Télécharger le certificat' })).getAttribute('aria-disabled')).toBe('true');
  });

  it('refuse côté source la relance d’une demande annulée', async () => {
    const { sources } = renderLot(<SignaturesPage />);
    await expect(sources.courriers.remindSignature('sg-2026-0010')).rejects.toThrow('Seule une demande en cours peut être relancée.');
  });

  it('télécharge les documents et le certificat', async () => {
    const create = vi.fn<(blob: Blob) => string>(() => 'blob:test');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn<(url: string) => void>() }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderLot(<SignaturesPage />);
    await open('SG-2026-0012', 'Télécharger les documents');
    expect(create).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Documents téléchargés')).toBeTruthy();
    vi.unstubAllGlobals();
  });
});

describe('CourriersPage, Modifier et signature', () => {
  it('propose Modifier sur un brouillon et mène au formulaire de modification', async () => {
    const { push } = renderLot(<CourriersPage />);
    await screen.findByRole('table', { name: 'Courriers' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, CR-2026-0040' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Modifier' }));
    expect(push).toHaveBeenCalledWith('/documents/courriers/cr-2026-0040/modifier');
  });

  it('désactive Modifier sur un courrier envoyé', async () => {
    renderLot(<CourriersPage />);
    await screen.findByRole('table', { name: 'Courriers' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, CR-2026-0041' }));
    expect((await screen.findByRole('menuitem', { name: 'Modifier' })).getAttribute('aria-disabled')).toBe('true');
  });

  it('envoie un courrier en signature avec titre et fichier préremplis', async () => {
    const { push } = renderLot(<CourriersPage />);
    await screen.findByRole('table', { name: 'Courriers' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, CR-2026-0035' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Envoyer en signature' }));
    expect(push).toHaveBeenCalledWith('/documents/signatures/nouvelle?titre=Convocation+%C3%A0+l%E2%80%99%C3%A9tat+des+lieux&fichier=CR-2026-0035.pdf');
  });
});

describe('CourrierFormPage, modification', () => {
  it('modifie l’objet et le message d’un brouillon sans en créer un nouveau', async () => {
    const { sources, push, container } = renderLot(<CourrierFormPage id="cr-2026-0040" />);
    const subject = await screen.findByLabelText('Objet *');
    await expectNoA11yViolations(container);
    await userEvent.clear(subject);
    await userEvent.type(subject, 'Deuxième relance');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/documents/courriers/cr-2026-0040'); });
    const all = await courriersOf(sources.courriers);
    expect(all).toHaveLength(4);
    expect(all.find((item) => item.id === 'cr-2026-0040')).toMatchObject({ subject: 'Deuxième relance', status: 'brouillon' });
  });

  it('valide l’objet obligatoire', async () => {
    const { sources } = renderLot(<CourrierFormPage id="cr-2026-0040" />);
    const subject = await screen.findByLabelText('Objet *');
    await userEvent.clear(subject);
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    expect(await screen.findByText('Renseignez l’objet du courrier')).toBeTruthy();
    expect((await courriersOf(sources.courriers)).find((item) => item.id === 'cr-2026-0040')?.subject).not.toBe('');
  });

  it('refuse la modification d’un courrier envoyé et signale un identifiant inconnu', async () => {
    const first = renderLot(<CourrierFormPage id="cr-2026-0041" />);
    expect(await screen.findByText('Un courrier envoyé ne peut plus être modifié. Créez un courrier similaire depuis la liste.')).toBeTruthy();
    expect(within(document.body).queryByRole('button', { name: 'Enregistrer les modifications' })).toBeNull();
    first.unmount();
    renderLot(<CourrierFormPage id="cr-inconnu" />);
    expect(await screen.findByText('Courrier introuvable', { selector: 'p, h1, h2' })).toBeTruthy();
  });

  it('refuse côté source la modification d’un courrier envoyé', async () => {
    const { sources } = renderLot(<CourrierFormPage id="cr-2026-0040" />);
    await expect(sources.courriers.updateCourrier('cr-2026-0041', { templateId: '', tenantId: 'koffi-adjovi', unitId: '', channel: 'email', subject: 'x', body: 'y' })).rejects.toThrow('Un courrier envoyé ne peut plus être modifié.');
  });
});
