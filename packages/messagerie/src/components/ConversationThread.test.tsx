import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../test/axe';
import type { Message, Participant } from '../data/schemas';
import { ConversationThread } from './ConversationThread';

const participants: Participant[] = [
  { id: 'u1', name: 'Koffi Adjovi', initials: 'KA', role: 'locataire' },
  { id: 'g1', name: 'Gestion Les Tilleuls', initials: 'GL', role: 'gestionnaire' },
];

const messages: Message[] = [
  { id: 'm1', authorId: 'g1', body: 'Bonjour,\nmerci de régulariser.', sentAt: '2026-11-08T09:15:00+01:00', attachments: [], internal: false },
  {
    id: 'm2',
    authorId: 'u1',
    body: 'C’est fait.',
    sentAt: '2026-11-09T18:40:00+01:00',
    attachments: [{ id: 'a1', name: 'preuve.pdf', sizeBytes: 204_800, mimeType: 'application/pdf' }],
    internal: false,
  },
  { id: 'm3', authorId: 'g1', body: 'Vérifier le virement.', sentAt: '2026-11-10T08:00:00+01:00', attachments: [], internal: true },
  { id: 'm4', authorId: 'ghost', body: 'Message d’un auteur inconnu.', sentAt: '2026-11-10T09:00:00+01:00', attachments: [], internal: false },
];

describe('ConversationThread', () => {
  it('affiche chaque message avec auteur, date, pièces jointes et note interne', async () => {
    const { container } = render(<ConversationThread messages={messages} participants={participants} viewerId="u1" />);
    const thread = screen.getByRole('list', { name: 'Fil de la conversation' });
    expect(thread.querySelectorAll('article')).toHaveLength(4);
    const own = screen.getByRole('article', { name: 'Message de Koffi Adjovi' });
    expect(within(own).getByText('preuve.pdf')).toBeTruthy();
    expect(within(own).getByText('200 Ko')).toBeTruthy();
    expect(within(own).getByText('09/11/2026, 18:40')).toBeTruthy();
    const note = screen.getByText('Vérifier le virement.').closest('article');
    expect(note?.textContent).toContain('Note interne');
    expect(screen.getByRole('article', { name: 'Message de Participant inconnu' })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('fait défiler jusqu’au dernier message à l’affichage', () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    render(<ConversationThread messages={messages} participants={participants} viewerId="u1" />);
    expect(scroll).toHaveBeenCalled();
  });
});
