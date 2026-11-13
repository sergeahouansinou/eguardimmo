import { render, screen } from '@testing-library/react';
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
