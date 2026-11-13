import type { Meta, StoryObj } from '@storybook/react-vite';
import { Building2, House, Settings, Users } from 'lucide-react';
import { BottomNav } from './BottomNav';
import { SideNav } from './SideNav';
import type { NavSection } from './types';

const sections: NavSection[] = [
  {
    id: 'principal',
    label: 'Principal',
    entries: [
      { id: 'accueil', label: 'Accueil', href: '/', icon: House },
      {
        id: 'biens',
        label: 'Biens',
        href: '/biens',
        icon: Building2,
        count: 11,
        children: [
          { id: 'lots', label: 'Lots', href: '/biens' },
          { id: 'immeubles', label: 'Immeubles', href: '/biens/immeubles' },
        ],
      },
      { id: 'locataires', label: 'Locataires', href: '/locataires', icon: Users, count: 10 },
    ],
  },
];

const meta = {
  title: 'Coquille/SideNav',
  component: SideNav,
  args: {
    label: 'Navigation principale',
    sections,
    footer: [{ id: 'reglages', label: 'Réglages', href: '/reglages', icon: Settings }],
    currentPath: '/biens/immeubles',
  },
  decorators: [(Story) => <div className="flex h-[600px]"><Story /></div>],
} satisfies Meta<typeof SideNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Deplie: Story = {};
export const Replie: Story = { args: { collapsed: true } };

export const Mobile: Story = {
  render: () => (
    <BottomNav
      label="Navigation principale"
      currentPath="/"
      items={[
        { id: 'accueil', label: 'Accueil', icon: House, href: '/' },
        { id: 'biens', label: 'Biens', icon: Building2, href: '/biens' },
        { id: 'locataires', label: 'Locataires', icon: Users, href: '/locataires' },
      ]}
    />
  ),
};
