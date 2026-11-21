import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildPlans } from '@/console/demo/plans';
import { renderWithConsole } from '../../../test/render';
import { AbonnementsScreen } from './AbonnementsScreen';
import { PlanFormScreen } from './PlanFormScreen';

describe('grille des plans (ADR 0013)', () => {
  it('reprend noms, prix mensuels et annuels, essai et quotas de la grille', () => {
    const [gratuit, silver, gold] = buildPlans();
    expect([gratuit?.name, gratuit?.monthlyMinor, gratuit?.yearlyMinor]).toEqual(['Gratuit', 0, 0]);
    expect([silver?.name, silver?.monthlyMinor, silver?.yearlyMinor]).toEqual(['Silver', 490, 5800]);
    expect([gold?.name, gold?.monthlyMinor, gold?.yearlyMinor]).toEqual(['Gold', 1090, 11800]);
    expect([gratuit, silver, gold].map((plan) => plan?.trialDays)).toEqual([15, 15, 15]);
    expect(gratuit?.limits).toEqual({ users: 1, lots: 1, tenants: 2, leases: 2, inspections: 4, storageMb: 50, signaturesMonth: null });
    expect(silver?.limits).toMatchObject({ lots: 5, tenants: null, storageMb: 500, signaturesMonth: 10 });
    expect(gold?.limits).toMatchObject({ lots: null, tenants: null, storageMb: 5000, signaturesMonth: 20 });
  });

  it('liste les plans de la grille avec leurs prix HT dans l’écran des abonnements', async () => {
    renderWithConsole(<AbonnementsScreen />);
    const table = await screen.findByRole('table', { name: 'Plans' });
    expect(within(table).getByText('Gratuit')).toBeTruthy();
    expect(within(table).getByText(/^4,90\s€ \/ mois · 58\s€ \/ an$/)).toBeTruthy();
    expect(within(table).getByText(/^10,90\s€ \/ mois · 118\s€ \/ an$/)).toBeTruthy();
    for (const ancien of ['Essentiel', 'Pro', 'Agence']) expect(within(table).queryByText(ancien)).toBeNull();
  });

  it('préremplit le formulaire du plan Silver avec ses prix et ses quotas', async () => {
    renderWithConsole(<PlanFormScreen planId="silver" />);
    await waitFor(() => { expect(screen.getByRole<HTMLInputElement>('textbox', { name: /Prix mensuel HT/ }).value).toBe('4,90'); });
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: /Prix annuel HT/ }).value).toBe('58');
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Lots' }).value).toBe('5');
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Utilisateurs' }).value).toBe('');
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: /Stockage, Mo/ }).value).toBe('500');
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: /Signatures par mois/ }).value).toBe('10');
  });
});
