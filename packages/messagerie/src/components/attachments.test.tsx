import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../test/axe';
import { pdf } from '../../test/render';
import { AttachmentChip, AttachmentList, AttachmentPicker, useAttachments } from './attachments';

function Harness({ variant = 'icon' as 'icon' | 'zone' }) {
  const attachments = useAttachments();
  return (
    <div>
      <AttachmentPicker attachments={attachments} variant={variant} />
      <AttachmentList files={attachments.files} onRemove={attachments.remove} />
    </div>
  );
}

const input = () => screen.getByLabelText('Choisir des fichiers');

describe('AttachmentChip', () => {
  it('affiche le nom et la taille, et retire la pièce', async () => {
    const onRemove = vi.fn();
    render(<AttachmentChip name="devis.pdf" sizeBytes={2048} mimeType="application/pdf" onRemove={onRemove} />);
    expect(screen.getByText('devis.pdf')).toBeTruthy();
    expect(screen.getByText('2 Ko')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Retirer devis.pdf' }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('n’affiche pas de bouton de retrait en lecture seule', () => {
    render(<AttachmentChip name="photo.jpg" sizeBytes={1_468_006} mimeType="image/jpeg" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('1,4 Mo')).toBeTruthy();
  });
});

describe('AttachmentPicker', () => {
  it.each(['icon', 'zone'] as const)('ajoute puis retire un fichier valide (%s)', async (variant) => {
    const { container } = render(<Harness variant={variant} />);
    await userEvent.upload(input(), pdf('devis.pdf'));
    expect(await screen.findByText('devis.pdf')).toBeTruthy();
    await expectNoA11yViolations(container);
    await userEvent.click(screen.getByRole('button', { name: 'Retirer devis.pdf' }));
    expect(screen.queryByText('devis.pdf')).toBeNull();
  });

  it('refuse un type de fichier non accepté avec un message', async () => {
    render(<Harness />);
    const exe = new File(['x'], 'virus.exe', { type: 'application/x-msdownload' });
    await userEvent.upload(input(), exe, { applyAccept: false });
    expect((await screen.findByRole('alert')).textContent).toContain('seuls les PDF et les images');
    expect(screen.queryByText('virus.exe')).toBeNull();
  });

  it('refuse un fichier de plus de 10 Mo', async () => {
    render(<Harness />);
    await userEvent.upload(input(), pdf('gros.pdf', 11 * 1024 * 1024));
    expect((await screen.findByRole('alert')).textContent).toContain('dépasse 10 Mo');
  });

  it('limite à 5 pièces jointes et bloque ensuite le bouton', async () => {
    render(<Harness />);
    await userEvent.upload(input(), Array.from({ length: 6 }, (_, index) => pdf(`piece-${String(index)}.pdf`)));
    await waitFor(() => { expect(screen.getAllByRole('listitem')).toHaveLength(5); });
    expect(screen.getByRole('alert').textContent).toContain('5 pièces jointes au maximum');
    expect(screen.getByRole('button', { name: 'Joindre un document' }).hasAttribute('disabled')).toBe(true);
  });
});
