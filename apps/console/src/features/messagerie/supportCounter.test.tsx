import { MessagerieProvider, consoleProfile, createDemoMessagerieSource, ticketStatsSchema } from '@eguardimmo/messagerie';
import { screen, waitFor, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';
import { EspaceShell } from '@/app/(espace)/EspaceShell';
import { messagerieRoutes } from '@/espace/messagerie';
import { router } from '../../../test/navigation';
import { renderWithConsole } from '../../../test/render';

function Anchor({ children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a {...props}>{children}</a>;
}

describe('compteur Support de la navigation', () => {
  it('reprend le nombre de tickets ouverts', async () => {
    const source = createDemoMessagerieSource({ space: 'console' });
    const before = ticketStatsSchema.parse(await source.ticketStats()).open;
    await source.updateTicket('tk-2094', { status: 'resolu' });
    const open = ticketStatsSchema.parse(await source.ticketStats()).open;
    expect(open).toBe(before - 1);
    renderWithConsole(
      <MessagerieProvider source={source} profile={consoleProfile} routes={messagerieRoutes} Link={Anchor} navigate={(href) => { router.push(href); }}>
        <EspaceShell>
          <p>Contenu</p>
        </EspaceShell>
      </MessagerieProvider>,
    );
    await waitFor(() => {
      const link = screen.getAllByRole('link', { name: /Support/ }).find((item) => item.getAttribute('href') === '/support');
      if (!link) throw new Error('Lien Support absent');
      expect(within(link).getByText(String(open))).toBeTruthy();
    });
  });
});
