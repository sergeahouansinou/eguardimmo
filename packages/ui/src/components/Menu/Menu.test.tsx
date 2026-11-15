import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { Button } from '../Button/Button';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSegmented, MenuSeparator, MenuTrigger } from './Menu';

function Exemple({ onLogout }: { onLogout: () => void }) {
  const [theme, setTheme] = useState('light');
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button>Compte</Button>
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>Mon compte</MenuLabel>
        <MenuItem meta="Essentiel">Abonnement</MenuItem>
        <MenuSeparator />
        <MenuSegmented
          label="Apparence"
          value={theme}
          onValueChange={setTheme}
          options={[
            { value: 'light', label: 'Clair' },
            { value: 'dark', label: 'Sombre' },
          ]}
        />
        <MenuItem icon={LogOut} tone="danger" onSelect={onLogout}>
          Se déconnecter
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

describe('Menu', () => {
  it('s’ouvre, affiche ses entrées et exécute une action', async () => {
    const onLogout = vi.fn();
    render(<Exemple onLogout={onLogout} />);
    await userEvent.click(screen.getByRole('button', { name: 'Compte' }));
    expect(await screen.findByRole('menu', { name: 'Compte' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Abonnement/ }).textContent).toContain('Essentiel');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Se déconnecter' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('garde le menu ouvert quand on change l’apparence', async () => {
    render(<Exemple onLogout={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Compte' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Sombre' }));
    expect(screen.getByRole('menuitemradio', { name: 'Sombre' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('rend un vrai lien quand href est fourni et reste accessible', async () => {
    render(
      <Menu>
        <MenuTrigger asChild>
          <Button>Compte</Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem icon={LogOut} href="https://auth.eguardimmo.example/profils">
            Changer d’espace
          </MenuItem>
        </MenuContent>
      </Menu>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Compte' }));
    const item = await screen.findByRole('menuitem', { name: 'Changer d’espace' });
    expect(item.tagName).toBe('A');
    expect(item.getAttribute('href')).toBe('https://auth.eguardimmo.example/profils');
    await expectNoA11yViolations(await screen.findByRole('menu'));
  });

  it('n’a aucune violation axe une fois ouvert', async () => {
    render(<Exemple onLogout={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Compte' }));
    await expectNoA11yViolations(await screen.findByRole('menu'));
  });
});
