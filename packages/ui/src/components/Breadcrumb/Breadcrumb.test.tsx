import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { Breadcrumb } from './Breadcrumb';

function TestLink({ children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a {...props}>{children}</a>;
}

describe('Breadcrumb', () => {
  it('lie les niveaux parents et marque la page courante', () => {
    render(
      <Breadcrumb
        Link={TestLink}
        items={[{ label: 'Messages', href: '/messages' }, { label: 'Nouveau message' }]}
      />,
    );
    expect(screen.getByRole('navigation', { name: 'Fil d’Ariane' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Messages' }).getAttribute('href')).toBe('/messages');
    expect(screen.getByText('Nouveau message').getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('link', { name: 'Nouveau message' })).toBeNull();
  });

  it('ne rend pas le dernier niveau en lien même avec un href', () => {
    render(<Breadcrumb Link={TestLink} items={[{ label: 'Support', href: '/support' }]} />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('n’a aucune violation d’accessibilité', async () => {
    const { container } = render(
      <Breadcrumb Link={TestLink} items={[{ label: 'Messages', href: '/messages' }, { label: 'Conversation' }]} />,
    );
    await expectNoA11yViolations(container);
  });
});
