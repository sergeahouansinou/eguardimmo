import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../test/axe';
import { pdf } from '../../test/render';
import { Composer } from './Composer';

const placeholder = 'Ex. Bonjour, le virement est programmé.';
const field = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Votre réponse' });

describe('Composer', () => {
  it('envoie le message nettoyé avec ses pièces jointes puis se vide', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<Composer onSend={onSend} placeholder={placeholder} />);
    await userEvent.type(field(), '  Virement fait  ');
    await userEvent.upload(screen.getByLabelText('Choisir des fichiers'), pdf('preuve.pdf'));
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    await waitFor(() => { expect(onSend).toHaveBeenCalledOnce(); });
    expect(onSend).toHaveBeenCalledWith({ body: 'Virement fait', attachments: [expect.objectContaining({ name: 'preuve.pdf' })] });
    await waitFor(() => { expect(field().value).toBe(''); });
    expect(screen.queryByText('preuve.pdf')).toBeNull();
  });

  it('refuse un message vide sans appeler la source', async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} placeholder={placeholder} />);
    await userEvent.type(field(), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText('Saisissez votre message')).toBeTruthy();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('envoie avec Ctrl+Entrée', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<Composer onSend={onSend} placeholder={placeholder} />);
    await userEvent.type(field(), 'Bonjour{Control>}{Enter}{/Control}');
    await waitFor(() => { expect(onSend).toHaveBeenCalledOnce(); });
  });

  it('affiche l’erreur de la source et conserve le texte saisi', async () => {
    const onSend = vi.fn().mockRejectedValue(new Error('Service indisponible'));
    render(<Composer onSend={onSend} placeholder={placeholder} />);
    await userEvent.type(field(), 'Bonjour');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Service indisponible');
    expect(field().value).toBe('Bonjour');
  });

  it('propose une note interne qui change le bouton et la charge utile', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<Composer onSend={onSend} placeholder={placeholder} allowInternal />);
    await expectNoA11yViolations(container);
    await userEvent.type(field(), 'À surveiller');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Note interne' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter la note' }));
    await waitFor(() => { expect(onSend).toHaveBeenCalledOnce(); });
    expect(onSend.mock.calls[0]?.[0]).toMatchObject({ body: 'À surveiller', internal: true });
  });
});
