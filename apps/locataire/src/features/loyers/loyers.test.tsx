import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDemoSource } from '@/data/demoSource';
import type { LocataireSource } from '@/data/source';
import { expectNoA11yViolations } from '../../../test/axe';
import { nav } from '../../../test/navigation';
import { renderScreen } from '../../../test/render';
import { ChargesScreen } from './ChargesScreen';
import { LoyersScreen } from './LoyersScreen';
import { PayerScreen } from './PayerScreen';
import { PaymentStatusScreen } from './PaymentStatusScreen';
import { ProviderSimulation } from './ProviderSimulation';
import { ReceiptScreen } from './ReceiptScreen';
import { SepaScreen } from './SepaScreen';

const VALID_IBAN = 'FR76 3000 6000 0112 3456 7890 189';

async function startPayment(source: LocataireSource, method: 'carte' | 'virement') {
  const payment = (await source.startPayment({ installmentId: '2026-11', method })) as { id: string };
  return payment.id;
}

describe('Loyers et quittances', () => {
  it('liste les échéances avec l’action de paiement et la quittance', async () => {
    const { container } = renderScreen(<LoyersScreen />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Loyers et quittances' })).toBeTruthy();
    const table = await screen.findByRole('table', { name: /échéances/i });
    expect(within(table).getByRole('link', { name: 'Payer Novembre 2026' }).getAttribute('href')).toBe('/loyers/payer?echeance=2026-11');
    expect(within(table).getByRole('link', { name: 'Quittance Octobre 2026' }).getAttribute('href')).toBe('/loyers/quittances/QT-2026-0398');
    await expectNoA11yViolations(container);
  });

  it('affiche un message quand le chargement échoue, avec un bouton pour réessayer', async () => {
    const source = createDemoSource();
    const installments = vi.fn<LocataireSource['installments']>().mockRejectedValueOnce(new Error('réseau')).mockImplementation(source.installments);
    const { user } = renderScreen(<LoyersScreen />, { source: { ...source, installments } });
    expect(await screen.findByText(/n’ont pas pu être chargé|n’a pas pu être chargé/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('table', { name: /échéances/i })).toBeTruthy();
  });
});

describe('Payer mon loyer', () => {
  it('lance un paiement par carte et redirige vers la page de paiement simulée', async () => {
    const { user, container } = renderScreen(<PayerScreen />);
    expect(await screen.findByText(/Étape 1 sur 2/)).toBeTruthy();
    await expectNoA11yViolations(container);
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(screen.getByText(/Étape 2 sur 2/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Payer 850,00/ }));
    await waitFor(() => { expect(nav.push).toHaveBeenCalledWith('/loyers/payer/simulation/PAY-2026-0931'); });
  });

  it('n’affiche aucun champ de carte bancaire', async () => {
    renderScreen(<PayerScreen />);
    await screen.findByText(/Étape 1 sur 2/);
    expect(document.querySelector('input[autocomplete^="cc-"]')).toBeNull();
    expect(screen.queryByLabelText(/numéro de carte|cryptogramme|CVV/i)).toBeNull();
  });

  it('empêche de choisir le prélèvement tant que le mandat n’est pas actif', async () => {
    renderScreen(<PayerScreen />);
    await screen.findByText(/Étape 1 sur 2/);
    const radio = screen.getByRole('radio', { name: /Prélèvement SEPA/ });
    expect((radio as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByRole('link', { name: 'Activer le prélèvement SEPA' }).getAttribute('href')).toBe('/loyers/prelevement');
  });

  it('permet de revenir au choix du moyen depuis la confirmation', async () => {
    const { user } = renderScreen(<PayerScreen />);
    await screen.findByText(/Étape 1 sur 2/);
    await user.click(screen.getByRole('radio', { name: /Virement bancaire/ }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(screen.getByRole('button', { name: 'Modifier le moyen' }));
    expect(screen.getByText(/Étape 1 sur 2/)).toBeTruthy();
  });

  it('affiche l’erreur de la source quand le paiement ne peut pas démarrer', async () => {
    const source = createDemoSource();
    const startFailing = vi.fn<LocataireSource['startPayment']>().mockRejectedValue(new Error('Service indisponible'));
    const { user } = renderScreen(<PayerScreen />, { source: { ...source, startPayment: startFailing } });
    await screen.findByText(/Étape 1 sur 2/);
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(screen.getByRole('button', { name: /^Payer 850,00/ }));
    expect(await screen.findByText('Service indisponible')).toBeTruthy();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('indique qu’aucun loyer n’est à régler quand tout est payé', async () => {
    const source = createDemoSource();
    const id = await startPayment(source, 'carte');
    await source.resolvePayment({ paymentId: id, outcome: 'reussi' });
    renderScreen(<PayerScreen />, { source });
    expect(await screen.findByText('Aucun loyer à régler')).toBeTruthy();
  });
});

describe('Page de paiement simulée', () => {
  it('rappelle qu’il s’agit d’une simulation et conclut un paiement réussi', async () => {
    const source = createDemoSource();
    const id = await startPayment(source, 'carte');
    const { user, container } = renderScreen(<ProviderSimulation paymentId={id} />, { source });
    expect(await screen.findByText('Simulation, aucun argent n’est débité')).toBeTruthy();
    await expectNoA11yViolations(container);
    await user.click(screen.getByRole('button', { name: /Simuler un paiement réussi/ }));
    await waitFor(() => { expect(nav.push).toHaveBeenCalledWith(`/loyers/paiements/${id}`); });
    const payment = (await source.payment(id)) as { status: string };
    expect(payment.status).toBe('reussi');
  });

  it('simule un échec ou une annulation', async () => {
    const source = createDemoSource();
    const id = await startPayment(source, 'carte');
    const { user } = renderScreen(<ProviderSimulation paymentId={id} />, { source });
    await user.click(await screen.findByRole('button', { name: /Simuler un échec/ }));
    await waitFor(() => { expect(nav.push).toHaveBeenCalled(); });
    expect(((await source.payment(id)) as { status: string }).status).toBe('echoue');
  });

  it('redirige vers l’état du paiement quand il est déjà résolu', async () => {
    const source = createDemoSource();
    const id = await startPayment(source, 'carte');
    await source.resolvePayment({ paymentId: id, outcome: 'annule' });
    renderScreen(<ProviderSimulation paymentId={id} />, { source });
    await waitFor(() => { expect(nav.replace).toHaveBeenCalledWith(`/loyers/paiements/${id}`); });
  });

  it('signale un paiement inconnu', async () => {
    renderScreen(<ProviderSimulation paymentId="PAY-2000-0001" />);
    expect(await screen.findByRole('heading', { name: 'Paiement introuvable' })).toBeTruthy();
  });
});

describe('État du paiement', () => {
  it('confirme un paiement réussi avec le lien vers la quittance', async () => {
    const source = createDemoSource();
    const id = await startPayment(source, 'carte');
    await source.resolvePayment({ paymentId: id, outcome: 'reussi' });
    const { container } = renderScreen(<PaymentStatusScreen paymentId={id} />, { source });
    expect(await screen.findByRole('heading', { level: 1, name: 'Paiement reçu' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Voir' }).getAttribute('href')).toBe('/loyers/quittances/QT-2026-0399');
    await expectNoA11yViolations(container);
  });

  it('propose de réessayer après un échec', async () => {
    const source = createDemoSource();
    const id = await startPayment(source, 'carte');
    await source.resolvePayment({ paymentId: id, outcome: 'echoue' });
    renderScreen(<PaymentStatusScreen paymentId={id} />, { source });
    expect(await screen.findByRole('heading', { level: 1, name: 'Paiement échoué' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Réessayer le paiement' }).getAttribute('href')).toBe('/loyers/payer?echeance=2026-11');
  });

  it('attend la réception des fonds pour un virement', async () => {
    const source = createDemoSource();
    const id = await startPayment(source, 'virement');
    await source.resolvePayment({ paymentId: id, outcome: 'reussi' });
    renderScreen(<PaymentStatusScreen paymentId={id} />, { source });
    expect(await screen.findByRole('heading', { level: 1, name: 'Paiement en attente' })).toBeTruthy();
  });

  it('signale un paiement inconnu', async () => {
    renderScreen(<PaymentStatusScreen paymentId="PAY-2000-0001" />);
    expect(await screen.findByRole('heading', { name: 'Paiement introuvable' })).toBeTruthy();
  });
});

describe('Quittance', () => {
  it('affiche l’aperçu A4 et déclenche l’impression', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const { user, container } = renderScreen(<ReceiptScreen receiptId="QT-2026-0398" />);
    expect(await screen.findByRole('heading', { level: 1, name: "Quittance d'octobre 2026" })).toBeTruthy();
    expect(container.querySelector('.print-area')).not.toBeNull();
    await expectNoA11yViolations(container);
    await user.click(screen.getByRole('button', { name: 'Imprimer' }));
    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
  });

  it('télécharge un PDF de démonstration', async () => {
    const { user } = renderScreen(<ReceiptScreen receiptId="QT-2026-0398" />);
    await screen.findByRole('heading', { level: 1 });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const createObjectURL = vi.spyOn(URL, 'createObjectURL');
    await user.click(screen.getByRole('button', { name: 'Télécharger' }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    createObjectURL.mockRestore();
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });

  it('vérifie le scellement dans une boîte de dialogue', async () => {
    const { user } = renderScreen(<ReceiptScreen receiptId="QT-2026-0398" />);
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('button', { name: 'Vérifier' }));
    const dialog = await screen.findByRole('dialog', { name: 'Vérification du scellement' });
    expect(within(dialog).getByText(/n’a pas été modifié/)).toBeTruthy();
  });

  it('signale une quittance inconnue', async () => {
    renderScreen(<ReceiptScreen receiptId="QT-2000-0001" />);
    expect(await screen.findByRole('heading', { name: 'Quittance introuvable' })).toBeTruthy();
  });
});

describe('Prélèvement SEPA', () => {
  it('signe un mandat avec un IBAN valide puis revient aux loyers', async () => {
    const source = createDemoSource();
    const { user, container } = renderScreen(<SepaScreen />, { source });
    await screen.findByRole('heading', { level: 1, name: 'Prélèvement SEPA' });
    await expectNoA11yViolations(container);
    await user.type(await screen.findByLabelText('IBAN'), VALID_IBAN);
    await user.click(screen.getByRole('checkbox', { name: /J’autorise/ }));
    await user.click(screen.getByRole('checkbox', { name: /titulaire du compte/ }));
    await user.click(screen.getByRole('button', { name: 'Signer le mandat' }));
    await waitFor(() => { expect(nav.push).toHaveBeenCalledWith('/loyers'); });
    const mandate = (await source.mandate()) as { status: string; ibanLast4: string };
    expect(mandate).toMatchObject({ status: 'actif', ibanLast4: '0189' });
  });

  it('refuse un IBAN dont la clé de contrôle est fausse', async () => {
    const source = createDemoSource();
    const sign = vi.spyOn(source, 'signMandate');
    const { user } = renderScreen(<SepaScreen />, { source });
    await user.type(await screen.findByLabelText('IBAN'), 'FR77 3000 6000 0112 3456 7890 189');
    await user.click(screen.getByRole('checkbox', { name: /J’autorise/ }));
    await user.click(screen.getByRole('checkbox', { name: /titulaire du compte/ }));
    await user.click(screen.getByRole('button', { name: 'Signer le mandat' }));
    expect(await screen.findByText(/clé de contrôle/)).toBeTruthy();
    expect(sign).not.toHaveBeenCalled();
  });

  it('exige les deux confirmations', async () => {
    const { user } = renderScreen(<SepaScreen />);
    await user.type(await screen.findByLabelText('IBAN'), VALID_IBAN);
    await user.click(screen.getByRole('button', { name: 'Signer le mandat' }));
    expect(await screen.findByText('Vous devez autoriser le prélèvement.')).toBeTruthy();
    expect(screen.getByText('Vous devez confirmer être titulaire du compte.')).toBeTruthy();
  });

  it('n’écrit jamais l’IBAN dans la console', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) => vi.spyOn(console, method).mockImplementation(() => undefined));
    const { user } = renderScreen(<SepaScreen />);
    await user.type(await screen.findByLabelText('IBAN'), VALID_IBAN);
    await user.click(screen.getByRole('checkbox', { name: /J’autorise/ }));
    await user.click(screen.getByRole('checkbox', { name: /titulaire du compte/ }));
    await user.click(screen.getByRole('button', { name: 'Signer le mandat' }));
    await waitFor(() => { expect(nav.push).toHaveBeenCalled(); });
    for (const spy of spies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain('3000');
      spy.mockRestore();
    }
  });

  it('affiche l’IBAN masqué d’un mandat actif et le révoque après confirmation', async () => {
    const source = createDemoSource();
    await source.signMandate({ holder: 'Koffi Adjovi', iban: VALID_IBAN, authorize: true, confirmHolder: true });
    const { user, container } = renderScreen(<SepaScreen />, { source });
    expect(await screen.findByText('•••• 0189')).toBeTruthy();
    expect(container.textContent).not.toContain('3000 6000');
    await user.click(screen.getByRole('button', { name: 'Révoquer le mandat' }));
    const dialog = await screen.findByRole('dialog', { name: 'Révoquer le mandat de prélèvement ?' });
    expect(((await source.mandate()) as { status: string }).status).toBe('actif');
    await user.click(within(dialog).getByRole('button', { name: 'Révoquer le mandat' }));
    await waitFor(() => { expect(nav.push).toHaveBeenCalledWith('/loyers'); });
    expect(((await source.mandate()) as { status: string }).status).toBe('revoque');
  });

  it('garde le mandat quand la révocation est annulée', async () => {
    const source = createDemoSource();
    await source.signMandate({ holder: 'Koffi Adjovi', iban: VALID_IBAN, authorize: true, confirmHolder: true });
    const { user } = renderScreen(<SepaScreen />, { source });
    await user.click(await screen.findByRole('button', { name: 'Révoquer le mandat' }));
    await user.click(await screen.findByRole('button', { name: 'Annuler' }));
    expect(((await source.mandate()) as { status: string }).status).toBe('actif');
  });
});

describe('Régularisation des charges', () => {
  it('affiche le décompte et reste accessible', async () => {
    const { container } = renderScreen(<ChargesScreen />);
    expect(await screen.findByRole('heading', { level: 1, name: /Régularisation des charges 2025/ })).toBeTruthy();
    await expectNoA11yViolations(container);
  });
});
