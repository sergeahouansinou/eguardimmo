import {
  HelpPage,
  MessagerieProvider,
  SupportBoardPage,
  TicketPage,
  consoleProfile,
  createDemoMessagerieSource,
} from '@eguardimmo/messagerie';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps, ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { messagerieRoutes } from '@/espace/messagerie';
import { expectNoA11yViolations } from '../../../test/axe';
import { router } from '../../../test/navigation';
import { renderWithConsole } from '../../../test/render';

function Anchor({ children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a {...props}>{children}</a>;
}

function withMessagerie(ui: ReactElement) {
  return (
    <MessagerieProvider
      source={createDemoMessagerieSource({ space: 'console' })}
      profile={consoleProfile}
      routes={messagerieRoutes}
      Link={Anchor}
      navigate={(href) => { router.push(href); }}
    >
      {ui}
    </MessagerieProvider>
  );
}

describe('Support de la console', () => {
  it('liste les tickets avec les indicateurs et un lien vers le détail', async () => {
    const { container } = renderWithConsole(withMessagerie(<SupportBoardPage />));
    expect(screen.getByRole('heading', { level: 1, name: 'Support' })).toBeTruthy();
    const list = await screen.findByRole('list', { name: 'Tickets' });
    expect(screen.getByRole('region', { name: 'Tickets ouverts' })).toBeTruthy();
    expect(within(list).getByRole('link', { name: /E-mails de relance non reçus/ }).getAttribute('href')).toBe('/support/tk-2094');
    await expectNoA11yViolations(container);
  });

  it('le détail d’un ticket change de statut, résout puis rouvre', async () => {
    const { container } = renderWithConsole(withMessagerie(<TicketPage ticketId="tk-2094" />));
    expect(await screen.findByRole('heading', { level: 1, name: /E-mails de relance non reçus/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Support' }).getAttribute('href')).toBe('/support');
    await expectNoA11yViolations(container);
    await userEvent.click(screen.getByRole('button', { name: 'Mettre en attente' }));
    expect(await screen.findByText('Ticket mis en attente du client.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Marquer résolu' }));
    expect(await screen.findByText('Ticket marqué comme résolu.')).toBeTruthy();
    await userEvent.click(await screen.findByRole('button', { name: 'Rouvrir' }));
    expect(await screen.findByText('Ticket rouvert.')).toBeTruthy();
  });

  it('répond au client depuis le ticket', async () => {
    renderWithConsole(withMessagerie(<TicketPage ticketId="tk-2094" />));
    await screen.findByRole('list', { name: 'Échanges du ticket' });
    await userEvent.type(screen.getByRole('textbox', { name: 'Votre réponse' }), 'Correctif déployé.');
    await userEvent.click(screen.getByRole('button', { name: 'Répondre' }));
    expect(await screen.findByText('Correctif déployé.')).toBeTruthy();
  });

  it('le centre d’aide présente les procédures sans ticket de support', async () => {
    const { container } = renderWithConsole(withMessagerie(<HelpPage />));
    expect(screen.getByRole('heading', { level: 1, name: 'Aide' })).toBeTruthy();
    expect((await screen.findAllByRole('heading', { level: 2 })).length).toBeGreaterThan(0);
    await waitFor(() => { expect(screen.queryByRole('button', { name: 'Écrire au support' })).toBeNull(); });
    await expectNoA11yViolations(container);
  });
});
