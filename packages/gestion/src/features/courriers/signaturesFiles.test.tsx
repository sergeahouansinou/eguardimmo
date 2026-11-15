import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { FROZEN_NOW, at, norm, renderLot } from '../../../test/lots';
import { SignatureNewPage } from './SignatureNewPage';
import { SignaturesPage } from './SignaturesPage';
import { MAX_SIGNATURE_FILES, signatureSchema } from './schemas';
import type { Signature } from './schemas';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN_NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const signaturesOf = async (source: { signatures: () => Promise<unknown> }) => (await source.signatures()) as Signature[];
const pdf = (name: string) => new File(['%PDF'], name, { type: 'application/pdf' });
const signer = { name: 'Nadège Sossou', email: 'nadege.sossou@example.com' };

describe('modèle de données des signatures', () => {
  it('relit une demande existante à un fichier (ancien format) comme une liste d’un fichier', () => {
    const legacy = { id: 'sg-2026-0001', reference: 'SG-2026-0001', title: 'Bail', fileName: 'bail.pdf', unitId: null, signers: [{ name: 'A B', email: 'a@example.com', status: 'attente' }], status: 'en_cours', createdOn: '2026-11-01', completedOn: null, reminderSentOn: null, fields: [] };
    expect(signatureSchema.parse(legacy)).toMatchObject({ fileName: 'bail.pdf', files: ['bail.pdf'] });
    expect(signatureSchema.parse({ ...legacy, files: ['a.pdf', 'b.pdf'] })).toMatchObject({ fileName: 'bail.pdf', files: ['a.pdf', 'b.pdf'] });
  });

  it('crée une demande à plusieurs fichiers et accepte encore l’ancien champ fileName', async () => {
    const { sources } = renderLot(<SignaturesPage />);
    await sources.courriers.createSignature({ title: 'Bail Apt A2', files: ['bail.pdf', 'annexe.pdf'], signers: [signer] });
    await sources.courriers.createSignature({ title: 'Avenant', fileName: 'avenant.pdf', signers: [signer] });
    const all = await signaturesOf(sources.courriers);
    expect(all.find((item) => item.id === 'sg-2026-0013')).toMatchObject({ fileName: 'bail.pdf', files: ['bail.pdf', 'annexe.pdf'] });
    expect(all.find((item) => item.id === 'sg-2026-0014')).toMatchObject({ fileName: 'avenant.pdf', files: ['avenant.pdf'] });
  });

  it('refuse l’absence de fichier, un fichier joint deux fois et trop de fichiers', () => {
    const { sources } = renderLot(<SignaturesPage />);
    expect(() => sources.courriers.createSignature({ title: 'X', files: [], signers: [signer] })).toThrow('Joignez le PDF à signer');
    expect(() => sources.courriers.createSignature({ title: 'X', files: ['a.pdf', 'a.pdf'], signers: [signer] })).toThrow('Un même fichier ne peut pas être joint deux fois');
    const many = Array.from({ length: MAX_SIGNATURE_FILES + 1 }, (_, index) => `f${String(index)}.pdf`);
    expect(() => sources.courriers.createSignature({ title: 'X', files: many, signers: [signer] })).toThrow('documents au maximum');
  });
});

describe('SignaturesPage, colonne Documents', () => {
  it('indique le nombre de fichiers de chaque demande', async () => {
    renderLot(<SignaturesPage />);
    const table = await screen.findByRole('table', { name: 'Demandes de signature' });
    expect(within(table).getByRole('columnheader', { name: 'Documents' })).toBeTruthy();
    const rows = within(table).getAllByRole('row').slice(1);
    const row = (reference: string) => at(rows.filter((entry) => entry.textContent.includes(reference)), 0);
    expect(norm(row('SG-2026-0011').textContent)).toContain('2 fichiers');
    expect(norm(row('SG-2026-0012').textContent)).toContain('1 fichier');
    expect(norm(row('SG-2026-0012').textContent)).not.toContain('1 fichiers');
  });
});

describe('SignatureNewPage, plusieurs documents', () => {
  it('ajoute plusieurs PDF, en retire un, puis envoie la demande avec les fichiers restants', async () => {
    const { sources, push, container } = renderLot(<SignatureNewPage />);
    await userEvent.type(await screen.findByLabelText('Titre du document *'), 'Bail Apt A2');
    await userEvent.upload(screen.getByLabelText('Importer le PDF à signer'), pdf('bail.pdf'));
    await userEvent.upload(await screen.findByLabelText('Ajouter un autre PDF'), pdf('annexe.pdf'));
    await userEvent.upload(await screen.findByLabelText('Ajouter un autre PDF'), pdf('diagnostics.pdf'));
    const list = screen.getByRole('list', { name: 'Documents à signer' });
    expect(within(list).getAllByRole('listitem').map((item) => norm(item.textContent))).toEqual(['bail.pdf', 'annexe.pdf', 'diagnostics.pdf']);
    await expectNoA11yViolations(container);
    await userEvent.click(within(list).getByRole('button', { name: 'Retirer annexe.pdf' }));
    expect(within(screen.getByRole('list', { name: 'Documents à signer' })).getAllByRole('listitem')).toHaveLength(2);
    await userEvent.upload(await screen.findByLabelText('Ajouter un autre PDF'), pdf('annexe.pdf'));
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    await userEvent.type(screen.getByLabelText('Nom du signataire 1'), signer.name);
    await userEvent.type(screen.getByLabelText('E-mail du signataire 1'), signer.email);
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(norm((await screen.findByText(/bail\.pdf, diagnostics\.pdf, annexe\.pdf/)).textContent)).toContain('Bail Apt A2');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer pour signature' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/documents/signatures'); });
    expect((await signaturesOf(sources.courriers)).find((item) => item.id === 'sg-2026-0013')?.files).toEqual(['bail.pdf', 'diagnostics.pdf', 'annexe.pdf']);
  });

  it('valide chaque fichier ajouté en type et en taille sans l’ajouter à la liste', async () => {
    renderLot(<SignatureNewPage />, { search: 'fichier=bail.pdf' });
    await userEvent.upload(await screen.findByLabelText('Ajouter un autre PDF'), new File(['x'], 'photo.png', { type: 'image/png' }), { applyAccept: false });
    expect(await screen.findByText('Ce type de fichier n’est pas accepté.')).toBeTruthy();
    const heavy = new File(['x'], 'lourd.pdf', { type: 'application/pdf' });
    Object.defineProperty(heavy, 'size', { value: 21 * 1_048_576 });
    await userEvent.upload(screen.getByLabelText('Ajouter un autre PDF'), heavy);
    expect(await screen.findByText('Le fichier dépasse 20 Mo.')).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'Documents à signer' })).getAllByRole('listitem')).toHaveLength(1);
  });

  it('signale un fichier joint deux fois et bloque l’étape', async () => {
    renderLot(<SignatureNewPage />, { search: 'fichier=bail.pdf&titre=Bail' });
    await userEvent.upload(await screen.findByLabelText('Ajouter un autre PDF'), pdf('bail.pdf'));
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(await screen.findByText('Un même fichier ne peut pas être joint deux fois')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Étape 1, Document' })).toBeTruthy();
  });
});
