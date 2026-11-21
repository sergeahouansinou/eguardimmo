import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import * as api from './api/responses.fixtures';
import { LibraryPage } from './LibraryPage';
import { filesUrl, libraryUrl, renderLibrary } from './testing';

beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:file'), revokeObjectURL: vi.fn() }));
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const list = (body: unknown = api.libraryPage) => ({ [`GET ${libraryUrl()}`]: { body } });
const rowOf = (name: string): HTMLElement => {
  const row = within(screen.getByRole('table', { name: 'Documents de la bibliothèque' })).getAllByRole('row').find((candidate) => candidate.textContent.includes(name));
  if (!row) throw new Error(`Ligne « ${name} » absente`);
  return row;
};

describe('liste de la bibliothèque', () => {
  it('affiche nature, objet, état d’analyse et ne propose le téléchargement qu’aux fichiers sains', async () => {
    const { container } = renderLibrary(<LibraryPage mandateLabelOf={() => 'Mandat M-2026-0012'} />, list());

    await screen.findByRole('table', { name: 'Documents de la bibliothèque' });
    const mandate = rowOf('Mandat de gestion M-2026-0012.pdf');
    expect(mandate.textContent).toContain('Mandat M-2026-0012');
    expect(mandate.textContent).toContain('Analysé, sain');
    expect(mandate.textContent).toContain('47 Ko');
    expect(within(mandate).getByRole('button', { name: /^Télécharger Mandat de gestion/ })).toBeTruthy();

    const pending = rowOf('Diagnostic gaz.pdf');
    expect(pending.textContent).toContain('Analyse en cours');
    expect(within(pending).queryByRole('button', { name: /^Télécharger/ })).toBeNull();

    const infected = rowOf('Façade.jpg');
    expect(infected.textContent).toContain('Fichier non sain');
    expect(infected.textContent).toContain('bloqué');
    expect(within(infected).queryByRole('button', { name: /^Télécharger/ })).toBeNull();
    expect(within(infected).getByRole('button', { name: 'Archiver Façade.jpg' })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('place les actions dans la première colonne, accessible sans défilement horizontal', async () => {
    renderLibrary(<LibraryPage />, list());

    await screen.findByRole('table', { name: 'Documents de la bibliothèque' });
    const [firstCell] = within(rowOf('Mandat de gestion M-2026-0012.pdf')).getAllByRole('cell');
    if (!firstCell) throw new Error('première cellule absente');
    expect(within(firstCell).getByRole('button', { name: /^Télécharger Mandat de gestion/ })).toBeTruthy();
    expect(within(firstCell).getByRole('button', { name: /^Archiver Mandat de gestion/ })).toBeTruthy();
  });

  it('filtre par nature et bascule vers les archives avec les paramètres attendus', async () => {
    const { callsTo } = renderLibrary(<LibraryPage />, {
      [`GET ${libraryUrl()}`]: ({ search }) => ({ body: search.get('archived') === '1' ? api.archivedPage : search.get('kind') === 'lease' ? api.libraryEmpty : api.libraryPage }),
    });
    await screen.findByRole('table', { name: 'Documents de la bibliothèque' });

    await userEvent.click(screen.getByRole('combobox', { name: /^Nature/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Bail' }));
    expect(await screen.findByText('Aucun document dans la bibliothèque')).toBeTruthy();
    expect(Object.fromEntries(callsTo('GET', libraryUrl()).at(-1)?.search ?? [])).toMatchObject({ kind: 'lease' });

    await userEvent.click(screen.getByRole('radio', { name: 'Archivés' }));
    const row = await screen.findByText('Ancien règlement.pdf');
    expect(row).toBeTruthy();
    expect(Object.fromEntries(callsTo('GET', libraryUrl()).at(-1)?.search ?? [])).toMatchObject({ kind: 'lease', archived: '1' });
  });

  it('charge la page suivante avec le curseur et conserve les lignes déjà reçues', async () => {
    const { callsTo } = renderLibrary(<LibraryPage />, {
      [`GET ${libraryUrl()}`]: ({ search }) => ({ body: search.get('cursor') === api.NEXT_CURSOR ? api.librarySecondPage : api.libraryFirstPage }),
    });
    await screen.findByText('Diagnostic gaz.pdf');
    expect(screen.queryByText('Façade.jpg')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Charger plus' }));

    expect(await screen.findByText('Façade.jpg')).toBeTruthy();
    expect(screen.getByText('Diagnostic gaz.pdf')).toBeTruthy();
    expect(callsTo('GET', libraryUrl()).at(-1)?.search.get('cursor')).toBe(api.NEXT_CURSOR);
    expect(screen.queryByRole('button', { name: 'Charger plus' })).toBeNull();
  });

  it('affiche l’état vide avec l’invitation à déposer', async () => {
    renderLibrary(<LibraryPage />, list(api.libraryEmpty));
    expect(await screen.findByText('Aucun document dans la bibliothèque')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Ajouter un document' }).length).toBeGreaterThan(0);
  });

  it('signale l’erreur serveur et recharge au clic sur Réessayer', async () => {
    let attempts = 0;
    renderLibrary(<LibraryPage />, {
      [`GET ${libraryUrl()}`]: () => {
        attempts += 1;
        return attempts === 1 ? { status: 403, body: api.problemForbidden } : { body: api.libraryPage };
      },
    });

    expect(await screen.findByText('La bibliothèque n’a pas pu être chargée')).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'Documents de la bibliothèque' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('table', { name: 'Documents de la bibliothèque' })).toBeTruthy();
    expect(attempts).toBe(2);
  });

  it('ne montre ni archivage ni dépôt au comptable', async () => {
    renderLibrary(<LibraryPage />, list(), { role: 'accountant' });
    await screen.findByRole('table', { name: 'Documents de la bibliothèque' });
    expect(screen.queryByRole('button', { name: /^Archiver/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Ajouter un document' })).toBeNull();
  });

  it('télécharge un fichier sain par le flux générique de fichiers', async () => {
    const downloadPath = filesUrl(`/${api.IDS.mandateFile}/download`);
    const { callsTo } = renderLibrary(<LibraryPage />, { ...list(), [`GET ${downloadPath}`]: { file: { content: '%PDF-1.4', type: 'application/pdf' } } });
    await screen.findByRole('table', { name: 'Documents de la bibliothèque' });

    await userEvent.click(within(rowOf('Mandat de gestion')).getByRole('button', { name: /^Télécharger/ }));

    await waitFor(() => { expect(callsTo('GET', downloadPath)).toHaveLength(1); });
  });

  it('signale document_not_clean au téléchargement', async () => {
    const downloadPath = filesUrl(`/${api.IDS.mandateFile}/download`);
    renderLibrary(<LibraryPage />, { ...list(), [`GET ${downloadPath}`]: { status: 409, body: api.problemNotClean } });
    await screen.findByRole('table', { name: 'Documents de la bibliothèque' });

    await userEvent.click(within(rowOf('Mandat de gestion')).getByRole('button', { name: /^Télécharger/ }));

    expect(await screen.findByText('Téléchargement impossible')).toBeTruthy();
    expect(screen.getByText(/n’a pas fini son analyse antivirus/)).toBeTruthy();
  });
});

describe('archivage et restauration', () => {
  const archivePath = libraryUrl(`/${api.IDS.mandateEntry}/archive`);

  it('demande confirmation, n’archive pas en cas d’annulation', async () => {
    const { callsTo } = renderLibrary(<LibraryPage />, list());
    await screen.findByRole('table', { name: 'Documents de la bibliothèque' });

    await userEvent.click(within(rowOf('Mandat de gestion')).getByRole('button', { name: /^Archiver/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Archiver ce document ?' });
    expect(dialog.textContent).toContain('Rien n’est supprimé');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));

    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
    expect(callsTo('POST', archivePath)).toHaveLength(0);
  });

  it('archive après confirmation puis recharge la liste', async () => {
    let archived = false;
    const { callsTo } = renderLibrary(<LibraryPage />, {
      [`GET ${libraryUrl()}`]: () => ({ body: archived ? api.page([api.diagnosticPending, api.photoInfected]) : api.libraryPage }),
      [`POST ${archivePath}`]: () => {
        archived = true;
        return { body: { data: { ...api.mandateEntry, archived_at: '2026-11-20T08:00:00+00:00', lock_version: 2 } } };
      },
    });
    await screen.findByRole('table', { name: 'Documents de la bibliothèque' });

    await userEvent.click(within(rowOf('Mandat de gestion')).getByRole('button', { name: /^Archiver/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Archiver' }));

    expect(await screen.findByText('Document archivé')).toBeTruthy();
    await waitFor(() => { expect(screen.queryByText('Mandat de gestion M-2026-0012.pdf', { selector: 'span' })).toBeNull(); });
    expect(callsTo('POST', archivePath)).toHaveLength(1);
  });

  it('affiche library_document_not_found si le document a disparu', async () => {
    renderLibrary(<LibraryPage />, { ...list(), [`POST ${archivePath}`]: { status: 404, body: api.problemNotFound } });
    await screen.findByRole('table', { name: 'Documents de la bibliothèque' });

    await userEvent.click(within(rowOf('Mandat de gestion')).getByRole('button', { name: /^Archiver/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Archiver' }));

    expect(await screen.findByText('Archivage impossible')).toBeTruthy();
    expect(screen.getByText(/n’existe pas ou n’est plus dans la bibliothèque/)).toBeTruthy();
  });

  it('restaure un document archivé', async () => {
    const restorePath = libraryUrl(`/${api.IDS.archivedEntry}/archive`);
    const { callsTo } = renderLibrary(<LibraryPage />, {
      [`GET ${libraryUrl()}`]: ({ search }) => ({ body: search.get('archived') === '1' ? api.archivedPage : api.libraryPage }),
      [`DELETE ${restorePath}`]: { body: { data: { ...api.archivedEntry, archived_at: null, lock_version: 3 } } },
    });
    await screen.findByRole('table', { name: 'Documents de la bibliothèque' });
    await userEvent.click(screen.getByRole('radio', { name: 'Archivés' }));
    await screen.findByText('Ancien règlement.pdf');

    await userEvent.click(screen.getByRole('button', { name: 'Restaurer Ancien règlement.pdf' }));

    expect(await screen.findByText('Document restauré')).toBeTruthy();
    expect(callsTo('DELETE', restorePath)).toHaveLength(1);
  });
});

describe('page Documents composée', () => {
  it('conserve la liste des justificatifs de conformité sous la bibliothèque', async () => {
    renderLibrary(<LibraryPage />, list());
    expect(await screen.findByRole('heading', { level: 1, name: 'Documents' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Bibliothèque' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Justificatifs de conformité' })).toBeTruthy();
    expect(await screen.findByText('Aucun justificatif de conformité')).toBeTruthy();
  });
});
