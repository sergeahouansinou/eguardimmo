import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderMessagerie } from '../../test/render';
import { createDemoMessagerieSource } from '../data/demo';
import { TicketPage } from '../pages/SupportPages';

describe('pièces jointes du ticket côté console', () => {
  it('laisse les pièces en lecture seule dans la démonstration', async () => {
    renderMessagerie(<TicketPage ticketId="tk-2094" />, { space: 'console', source: createDemoMessagerieSource({ space: 'console' }) });
    await screen.findByRole('list', { name: 'Échanges du ticket' });
    expect(screen.queryByRole('button', { name: /^Télécharger/ })).toBeNull();
  });
});
