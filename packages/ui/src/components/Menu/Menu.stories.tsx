import type { Meta, StoryObj } from '@storybook/react-vite';
import { LogOut, Settings } from 'lucide-react';
import { Button } from '../Button/Button';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from './Menu';

const meta = { title: 'Composants/Menu', component: Menu } satisfies Meta<typeof Menu>;

export default meta;

export const Compte: StoryObj<typeof meta> = {
  render: () => (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="secondary">Compte</Button>
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>Espace</MenuLabel>
        <MenuItem icon={Settings}>Réglages</MenuItem>
        <MenuItem meta="2 membres">Équipe</MenuItem>
        <MenuSeparator />
        <MenuItem icon={LogOut} tone="danger">Se déconnecter</MenuItem>
      </MenuContent>
    </Menu>
  ),
};

export const AvecLien: StoryObj<typeof meta> = {
  render: () => (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="secondary">Compte</Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem icon={Settings} href="https://auth.eguardimmo.example/compte/securite">Sécurité du compte</MenuItem>
        <MenuItem icon={LogOut} tone="danger" href="https://auth.eguardimmo.example/deconnecte">Se déconnecter</MenuItem>
      </MenuContent>
    </Menu>
  ),
};
