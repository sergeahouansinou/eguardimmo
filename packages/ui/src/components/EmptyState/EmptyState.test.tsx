import { render, screen } from '@testing-library/react';
import { Inbox } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('affiche titre, description et actions', () => {
    render(
      <EmptyState icon={Inbox} title="Aucun document" description="Importez votre premier document.">
        <button type="button">Importer</button>
      </EmptyState>,
    );
    expect(screen.getByText('Aucun document')).toBeTruthy();
    expect(screen.getByText('Importez votre premier document.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Importer' })).toBeTruthy();
  });

  it('omet la description et les actions absentes', () => {
    const { container } = render(<EmptyState icon={Inbox} title="Vide" />);
    expect(container.querySelector('p')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });
});
