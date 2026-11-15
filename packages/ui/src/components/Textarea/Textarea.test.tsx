import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('associe le label au champ et affiche le placeholder', () => {
    render(<Textarea label="Message" placeholder="Ex. Bonjour, le loyer sera réglé le 15." />);
    const field = screen.getByLabelText('Message');
    expect(field.tagName).toBe('TEXTAREA');
    expect(field.getAttribute('placeholder')).toBe('Ex. Bonjour, le loyer sera réglé le 15.');
    expect(field.hasAttribute('aria-invalid')).toBe(false);
  });

  it('accepte la saisie multiligne', async () => {
    render(<Textarea label="Message" placeholder="Ex. Bonjour" />);
    const field = screen.getByLabelText<HTMLTextAreaElement>('Message');
    await userEvent.type(field, 'Bonjour{Enter}Merci');
    expect(field.value).toBe('Bonjour\nMerci');
  });

  it('relie l’aide et l’erreur et pose aria-invalid', () => {
    render(<Textarea label="Message" placeholder="Ex. Bonjour" hint="1000 signes au maximum" error="Message requis" />);
    const field = screen.getByLabelText('Message');
    const ids = (field.getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids).toEqual([screen.getByText('1000 signes au maximum').id, screen.getByText('Message requis').id]);
    expect(field.getAttribute('aria-invalid')).toBe('true');
  });

  it('masque visuellement le label sans le retirer de l’accessibilité', () => {
    render(<Textarea label="Votre réponse" placeholder="Ex. Merci" hideLabel />);
    expect(screen.getByText('Votre réponse').className).toContain('sr-only');
    expect(screen.getByLabelText('Votre réponse')).toBeTruthy();
  });

  it('n’a aucune violation d’accessibilité', async () => {
    const { container } = render(<Textarea label="Message" placeholder="Ex. Bonjour" error="Message requis" />);
    await expectNoA11yViolations(container);
  });
});
