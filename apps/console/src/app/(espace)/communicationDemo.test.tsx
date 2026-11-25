import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MarketingPage from './marketing/page';
import NewCampaignPage from './marketing/nouvelle/page';
import RemindersPage from './rappels/page';

describe('communication en mode de démonstration', () => {
  it.each([
    ['Marketing', MarketingPage],
    ['Marketing', NewCampaignPage],
    ['Notifications et rappels', RemindersPage],
  ])('annonce que la page %s demande le serveur', (title, Page) => {
    render(<Page />);

    expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy();
    expect(screen.getByText(/Cette page demande le serveur/)).toBeTruthy();
  });
});
