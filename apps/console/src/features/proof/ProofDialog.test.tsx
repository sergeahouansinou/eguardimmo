import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { createProofBroker } from '@/platform/proof';
import { ProofDialogHost, normalizeProof } from './ProofDialog';

describe('normalisation de la preuve', () => {
  it('accepte six chiffres, espaces ignorés', () => {
    expect(normalizeProof('totp', '123 456')).toEqual({ kind: 'totp', code: '123456' });
  });

  it.each(['12345', '1234567', 'abcdef', ''])('refuse « %s » comme code d’application', (raw) => {
    expect(normalizeProof('totp', raw)).toBeNull();
  });

  it('accepte tout code de secours non vide, rogné', () => {
    expect(normalizeProof('recovery', '  abcde-fghij ')).toEqual({ kind: 'recovery', code: 'abcde-fghij' });
    expect(normalizeProof('recovery', '   ')).toBeNull();
  });
});

describe('fenêtre de confirmation', () => {
  it('ne s’affiche pas sans demande', () => {
    render(<ProofDialogHost broker={createProofBroker()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('transmet le code saisi puis se ferme', async () => {
    const broker = createProofBroker();
    const pending = broker.request(false);
    const { baseElement } = render(<ProofDialogHost broker={broker} />);

    const dialog = await screen.findByRole('dialog', { name: 'Confirmer avec votre code' });
    await expectNoA11yViolations(baseElement);
    await userEvent.type(screen.getByLabelText('Code de double authentification'), '123 456');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

    expect(await pending).toEqual({ kind: 'totp', code: '123456' });
    await waitFor(() => { expect(dialog.isConnected).toBe(false); });
  });

  it('refuse un code mal formé sans répondre au serveur', async () => {
    const broker = createProofBroker();
    void broker.request(false);
    render(<ProofDialogHost broker={broker} />);

    await userEvent.type(await screen.findByLabelText('Code de double authentification'), '12ab');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

    expect(await screen.findByText('Saisissez les 6 chiffres affichés par votre application.')).toBeTruthy();
    expect(broker.current()).not.toBeNull();
  });

  it('bascule sur un code de secours', async () => {
    const broker = createProofBroker();
    const pending = broker.request(false);
    render(<ProofDialogHost broker={broker} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Utiliser un code de secours' }));
    await userEvent.type(screen.getByLabelText('Code de secours'), 'abcde-fghij');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

    expect(await pending).toEqual({ kind: 'recovery', code: 'abcde-fghij' });
  });

  it('signale un code refusé et rend null à l’annulation', async () => {
    const broker = createProofBroker();
    const pending = broker.request(true);
    render(<ProofDialogHost broker={broker} />);

    expect(await screen.findByText('Ce code est incorrect ou a déjà été utilisé. Saisissez-en un nouveau.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(await pending).toBeNull();
  });

  it('rend null quand on referme la fenêtre au clavier', async () => {
    const broker = createProofBroker();
    const pending = broker.request(false);
    render(<ProofDialogHost broker={broker} />);

    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');

    expect(await pending).toBeNull();
  });
});
