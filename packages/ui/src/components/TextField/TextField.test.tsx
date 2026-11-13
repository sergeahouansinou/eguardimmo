import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { TextField } from './TextField';

describe('TextField', () => {
  it('associe le label au champ et affiche le placeholder', () => {
    render(<TextField label="Nom du locataire" placeholder="Ex. Awa Dossou" />);
    const input = screen.getByLabelText('Nom du locataire');
    expect(input.getAttribute('placeholder')).toBe('Ex. Awa Dossou');
    expect(input.getAttribute('type')).toBe('text');
    expect(input.hasAttribute('aria-describedby')).toBe(false);
    expect(input.hasAttribute('aria-invalid')).toBe(false);
  });

  it('accepte la saisie', async () => {
    render(<TextField label="Ville" placeholder="Ex. Cotonou" />);
    const input = screen.getByLabelText<HTMLInputElement>('Ville');
    await userEvent.type(input, 'Porto-Novo');
    expect(input.value).toBe('Porto-Novo');
  });

  it('relie l’aide via aria-describedby', () => {
    render(<TextField label="Loyer" placeholder="Ex. 150000" hint="Montant mensuel en FCFA" />);
    const input = screen.getByLabelText('Loyer');
    const hint = screen.getByText('Montant mensuel en FCFA');
    expect(input.getAttribute('aria-describedby')).toBe(hint.id);
  });

  it('relie l’erreur et pose aria-invalid', () => {
    render(<TextField label="E-mail" placeholder="Ex. nom@exemple.fr" error="Adresse invalide" />);
    const input = screen.getByLabelText('E-mail');
    const error = screen.getByText('Adresse invalide');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(error.id);
  });

  it('relie à la fois l’aide et l’erreur', () => {
    render(
      <TextField label="IFU" placeholder="Ex. 3201234567890" hint="13 chiffres" error="Trop court" />,
    );
    const input = screen.getByLabelText('IFU');
    const ids = (input.getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids).toEqual([screen.getByText('13 chiffres').id, screen.getByText('Trop court').id]);
  });

  it('génère des identifiants distincts pour deux champs', () => {
    render(
      <div>
        <TextField label="Prénom" placeholder="Ex. Awa" />
        <TextField label="Nom" placeholder="Ex. Dossou" />
      </div>,
    );
    expect(screen.getByLabelText('Prénom').id).not.toBe(screen.getByLabelText('Nom').id);
  });

  it('respecte disabled et readOnly', () => {
    render(
      <div>
        <TextField label="Désactivé" placeholder="Ex. valeur" disabled />
        <TextField label="Lecture seule" placeholder="Ex. valeur" readOnly defaultValue="figé" />
      </div>,
    );
    expect(screen.getByLabelText<HTMLInputElement>('Désactivé').disabled).toBe(true);
    expect(screen.getByLabelText<HTMLInputElement>('Lecture seule').readOnly).toBe(true);
  });

  it('transmet la ref', () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<TextField ref={ref} label="Ref" placeholder="Ex. test" />);
    expect(ref.current).toBe(screen.getByLabelText('Ref'));
  });

  it('n’a aucune violation axe', async () => {
    const { container } = render(
      <div>
        <TextField label="Nom" placeholder="Ex. Awa Dossou" hint="Tel que sur la pièce d’identité" />
        <TextField label="E-mail" placeholder="Ex. nom@exemple.fr" error="Adresse invalide" />
      </div>,
    );
    await expectNoA11yViolations(container);
  });
});
