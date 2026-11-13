import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { Button } from '../Button/Button';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('reste masquée au repos', () => {
    render(
      <Tooltip content="Aide contextuelle">
        <Button>Cible</Button>
      </Tooltip>,
    );
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('s’affiche au focus clavier', async () => {
    render(
      <Tooltip content="Aide contextuelle">
        <Button>Cible</Button>
      </Tooltip>,
    );
    await userEvent.tab();
    expect((await screen.findByRole('tooltip')).textContent).toBe('Aide contextuelle');
  });

  it('s’affiche au survol', async () => {
    render(
      <Tooltip content="Aide contextuelle" delayDuration={0}>
        <Button>Cible</Button>
      </Tooltip>,
    );
    await userEvent.hover(screen.getByRole('button', { name: 'Cible' }));
    expect(await screen.findByRole('tooltip')).toBeTruthy();
  });

  it('applique les classes de jeton sans ombre', async () => {
    render(
      <Tooltip content="Aide" defaultOpen>
        <Button>Cible</Button>
      </Tooltip>,
    );
    const content = (await screen.findAllByText('Aide')).find((el) =>
      el.className.includes('bg-tooltip'),
    );
    expect(content?.className).toContain('text-tooltip-fg');
    expect(content?.className).not.toContain('shadow');
  });

  it('n’a aucune violation axe', async () => {
    const { container } = render(
      <Tooltip content="Aide contextuelle">
        <Button>Cible</Button>
      </Tooltip>,
    );
    await expectNoA11yViolations(container);
  });
});
