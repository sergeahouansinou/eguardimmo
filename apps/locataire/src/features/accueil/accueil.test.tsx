import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDemoSource } from '@/data/demoSource';
import type { LocataireSource } from '@/data/source';
import { expectNoA11yViolations } from '../../../test/axe';
import { renderScreen } from '../../../test/render';
import { HomeScreen } from './HomeScreen';

describe('Accueil', () => {
  it('salue le locataire et signale le loyer impayé avec le lien de paiement', async () => {
    const { container } = renderScreen(<HomeScreen />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Bonjour Koffi' })).toBeTruthy();
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/Loyer de novembre, 850 € à régler/)).toBeTruthy();
    expect(within(alert).getByRole('link', { name: /Payer 850/ }).getAttribute('href')).toBe('/loyers/payer');
    expect(screen.getByRole('link', { name: 'Signaler un problème' }).getAttribute('href')).toBe('/interventions/nouvelle');
    await expectNoA11yViolations(container);
  });

  it('présente les paiements, demandes, messages et documents', async () => {
    renderScreen(<HomeScreen />);
    await screen.findByText('Mes derniers paiements');
    expect(screen.getByText('Mes demandes')).toBeTruthy();
    expect(screen.getByText('Mes documents')).toBeTruthy();
    expect(await screen.findByText('Merci de confirmer le virement avant le 20 novembre')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Quittance' })[0]?.getAttribute('href')).toBe('/loyers/quittances/QT-2026-0398');
  });

  it('n’affiche plus l’alerte de retard une fois le loyer réglé', async () => {
    const source = createDemoSource();
    const payment = (await source.startPayment({ installmentId: '2026-11', method: 'carte' })) as { id: string };
    await source.resolvePayment({ paymentId: payment.id, outcome: 'reussi' });
    renderScreen(<HomeScreen />, { source });
    await screen.findByText('Aucun loyer en attente');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('affiche une erreur avec une nouvelle tentative quand le chargement échoue', async () => {
    const source = createDemoSource();
    const lease = vi.fn<LocataireSource['lease']>().mockRejectedValueOnce(new Error('réseau')).mockImplementation(source.lease);
    const { user } = renderScreen(<HomeScreen />, { source: { ...source, lease } });
    const retry = (await screen.findAllByRole('button', { name: 'Réessayer' }))[0];
    if (!retry) throw new Error('bouton Réessayer absent');
    await user.click(retry);
    expect(await screen.findByRole('heading', { level: 1, name: 'Bonjour Koffi' })).toBeTruthy();
  });
});
