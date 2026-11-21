import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { uploadedPart } from '../api/testing';
import * as api from './api/responses.fixtures';
import { LibraryAddPage } from './LibraryAddPage';
import { libraryUrl, pdf, renderLibrary } from './testing';

const mandateOptions = [{ value: api.IDS.mandate, label: 'M-2026-0012 · Famille Dupont' }];
const renderAdd = (routes: Parameters<typeof renderLibrary>[1] = {}, role: 'owner' | 'manager' | 'accountant' = 'manager') =>
  renderLibrary(<LibraryAddPage mandateOptions={mandateOptions} />, routes, { role });

async function choose(name: RegExp, option: string | RegExp) {
  await userEvent.click(screen.getByRole('combobox', { name }));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}
const submit = () => userEvent.click(screen.getByRole('button', { name: 'Déposer le document' }));

describe('ajout dans la bibliothèque', () => {
  it('bloque le dépôt tant que fichier et nature manquent, sans appel réseau', async () => {
    const { callsTo, container } = renderAdd();
    await submit();

    expect(await screen.findByText('Choisissez le fichier à déposer.')).toBeTruthy();
    expect(screen.getByText('Choisissez la nature du document.')).toBeTruthy();
    expect(callsTo('POST', libraryUrl())).toHaveLength(0);
    await expectNoA11yViolations(container);
  });

  it('dépose un mandat rattaché à son mandat puis retourne à la liste', async () => {
    const { callsTo, push } = renderAdd({ [`POST ${libraryUrl()}`]: { status: 201, body: { data: api.mandateEntry } } });

    await userEvent.upload(screen.getByLabelText('Fichier *'), pdf('Mandat Dupont.pdf'));
    await choose(/^Nature/, 'Mandat');
    expect(screen.queryByRole('combobox', { name: /^Concerne/ })).toBeNull();
    await choose(/^Mandat \*/, /M-2026-0012/);
    await userEvent.type(screen.getByLabelText(/^Nom affiché/), 'Mandat Dupont');
    await userEvent.type(screen.getByLabelText(/^Conserver jusqu’au/), '2036-11-18');
    await submit();

    await waitFor(() => { expect(callsTo('POST', libraryUrl())).toHaveLength(1); });
    const form = callsTo('POST', libraryUrl())[0]?.form ?? null;
    expect(Object.fromEntries([...(form?.entries() ?? [])].filter(([key]) => key !== 'file'))).toEqual({
      kind: 'mandate',
      subject_type: 'mandate',
      subject_id: api.IDS.mandate,
      display_name: 'Mandat Dupont',
      retention_until: '2036-11-18',
    });
    expect(uploadedPart(form)).toMatchObject({ name: 'Mandat Dupont.pdf', type: 'application/pdf' });
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/documents'); });
  });

  it('dépose une photo sans objet avec le seul fichier et la nature', async () => {
    const { callsTo } = renderAdd({ [`POST ${libraryUrl()}`]: { status: 201, body: { data: api.photoInfected } } });
    await userEvent.upload(screen.getByLabelText('Fichier *'), new File(['jpg'], 'facade.jpg', { type: 'image/jpeg' }));
    await choose(/^Nature/, 'Photo');
    await submit();

    await waitFor(() => { expect(callsTo('POST', libraryUrl())).toHaveLength(1); });
    expect([...(callsTo('POST', libraryUrl())[0]?.form?.keys() ?? [])]).toEqual(['file', 'kind']);
  });

  it('refuse sur place un fichier d’un type interdit et ne le transmet pas', async () => {
    const { callsTo } = renderAdd();
    await userEvent.upload(screen.getByLabelText('Fichier *'), new File(['PK'], 'archive.zip', { type: 'application/zip' }), { applyAccept: false });

    expect((await screen.findAllByRole('alert')).some((alert) => alert.textContent.includes('Ce type de fichier n’est pas accepté'))).toBe(true);
    expect(screen.queryByTestId('file-name')).toBeNull();
    expect(callsTo('POST', libraryUrl())).toHaveLength(0);
  });

  it('affiche library_kind_subject_mismatch sur le champ objet sans quitter la page', async () => {
    const { push, callsTo } = renderAdd({ [`POST ${libraryUrl()}`]: { status: 422, body: api.problemMismatch } });
    await userEvent.upload(screen.getByLabelText('Fichier *'), pdf());
    await choose(/^Nature/, 'Autre');
    await choose(/^Concerne/, 'Agence');
    await submit();

    expect((await screen.findByRole('alert')).textContent).toContain('un mandat pour un mandat, un bail pour un bail');
    expect(callsTo('POST', libraryUrl())).toHaveLength(1);
    expect(push).not.toHaveBeenCalled();
  });

  it('affiche le refus de contenu du serveur sur le champ fichier', async () => {
    renderAdd({ [`POST ${libraryUrl()}`]: { status: 422, body: api.problemFileRefused } });
    await userEvent.upload(screen.getByLabelText('Fichier *'), pdf());
    await choose(/^Nature/, 'Autre');
    await submit();

    expect(await screen.findByText('Ce fichier contient du code exécutable.')).toBeTruthy();
  });

  it('affiche l’erreur serveur de la date de conservation', async () => {
    renderAdd({ [`POST ${libraryUrl()}`]: { status: 422, body: api.problemRetention } });
    await userEvent.upload(screen.getByLabelText('Fichier *'), pdf());
    await choose(/^Nature/, 'Autre');
    await submit();

    expect(await screen.findByText(/postérieure à aujourd’hui \(AAAA-MM-JJ\)/)).toBeTruthy();
  });

  it('renvoie un document avec date de validité vers la conformité et bloque le dépôt', async () => {
    const { callsTo } = renderAdd();
    await userEvent.upload(screen.getByLabelText('Fichier *'), pdf('DPE.pdf'));
    await choose(/^Nature/, 'Diagnostic');
    await userEvent.click(screen.getByRole('checkbox', { name: /date de validité/ }));

    const alert = await screen.findByText('À déposer comme pièce de conformité');
    expect(within(alert.closest('[role]') ?? document.body).getByRole('link', { name: 'Ajouter une pièce de conformité' }).getAttribute('href')).toBe('/conformite');
    expect(screen.getByRole('button', { name: 'Déposer le document' }).hasAttribute('disabled')).toBe(true);
    expect(callsTo('POST', libraryUrl())).toHaveLength(0);
  });

  it('liste les pièces produites ailleurs avec leurs liens', () => {
    renderAdd();
    expect(screen.getByRole('link', { name: 'Quittances de loyer' }).getAttribute('href')).toBe('/finances/loyers/quittances');
    expect(screen.getByRole('link', { name: 'Devis' }).getAttribute('href')).toBe('/devis');
  });

  it('désactive le dépôt pour le comptable', () => {
    renderAdd({}, 'accountant');
    expect(screen.getByText('Votre rôle ne permet pas de déposer un document.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Déposer le document' }).hasAttribute('disabled')).toBe(true);
  });
});
