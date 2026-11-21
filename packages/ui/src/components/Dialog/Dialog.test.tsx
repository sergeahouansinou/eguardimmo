import { render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { Dialog, DialogContent, DialogTrigger } from './Dialog';

function Exemple() {
  return (
    <Dialog>
      <DialogTrigger>Plus</DialogTrigger>
      <DialogContent title="Plus" description="Sections secondaires" placement="bottom">
        <p>Contenu</p>
      </DialogContent>
    </Dialog>
  );
}

describe('Dialog', () => {
  it('s’ouvre avec un titre accessible et se ferme par son bouton', async () => {
    render(<Exemple />);
    await userEvent.click(screen.getByRole('button', { name: 'Plus' }));
    const dialog = await screen.findByRole('dialog', { name: 'Plus' });
    expect(dialog.className).toContain('bottom-0');
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('se ferme avec Échap', async () => {
    render(<Exemple />);
    await userEvent.click(screen.getByRole('button', { name: 'Plus' }));
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('n’a aucune violation axe une fois ouvert', async () => {
    render(<Exemple />);
    await userEvent.click(screen.getByRole('button', { name: 'Plus' }));
    await expectNoA11yViolations(await screen.findByRole('dialog'));
  });
});

describe('Dialog, focus initial', () => {
  it('place le focus sur l’élément marqué data-autofocus', async () => {
    render(
      <Dialog>
        <DialogTrigger>Rechercher</DialogTrigger>
        <DialogContent title="Recherche" hideTitle>
          <input aria-label="Rechercher" placeholder="Ex. : Koffi Adjovi" data-autofocus />
        </DialogContent>
      </Dialog>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
    expect(document.activeElement).toBe(await screen.findByRole('textbox', { name: 'Rechercher' }));
  });
});

describe('Dialog, retour du focus', () => {
  it('rend le focus au bouton qui a ouvert un dialogue piloté par l’état, sans déclencheur', async () => {
    function Piloté() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => { setOpen(true); }}>Retirer</button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent title="Confirmer" description="Retirer le partage ?">
              <button type="button" data-autofocus>Annuler</button>
            </DialogContent>
          </Dialog>
        </>
      );
    }
    render(<Piloté />);
    const opener = screen.getByRole('button', { name: 'Retirer' });
    await userEvent.click(opener);
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => { expect(document.activeElement).toBe(opener); });
  });
});
