import type { Meta, StoryObj } from '@storybook/react-vite';
import { Plus } from 'lucide-react';
import { Icon } from '../Icon/Icon';
import { Button } from './Button';

const meta = {
  title: 'Composants/Button',
  component: Button,
  args: { children: 'Enregistrer' },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger', 'link'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primaire: Story = {};

export const Secondaire: Story = { args: { variant: 'secondary' } };

export const Discret: Story = { args: { variant: 'ghost' } };

export const Danger: Story = { args: { variant: 'danger', children: 'Supprimer' } };

export const Lien: Story = { args: { variant: 'link', children: 'Voir le détail' } };

export const Chargement: Story = { args: { loading: true, children: 'Envoi' } };

export const Desactive: Story = { args: { disabled: true } };

export const AvecIcone: Story = {
  render: (args) => (
    <Button {...args}>
      <Icon icon={Plus} />
      Ajouter un bien
    </Button>
  ),
};

export const CommeLien: Story = {
  render: (args) => (
    <Button {...args} asChild>
      <a href="#baux">Ouvrir les baux</a>
    </Button>
  ),
};

export const Tailles: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <Button {...args} size="sm">
        Petit
      </Button>
      <Button {...args} size="md">
        Moyen
      </Button>
      <Button {...args} size="lg">
        Grand
      </Button>
    </div>
  ),
};

export const Variantes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} variant="primary">
        Primaire
      </Button>
      <Button {...args} variant="secondary">
        Secondaire
      </Button>
      <Button {...args} variant="ghost">
        Discret
      </Button>
      <Button {...args} variant="danger">
        Danger
      </Button>
      <Button {...args} variant="link">
        Lien
      </Button>
    </div>
  ),
};
