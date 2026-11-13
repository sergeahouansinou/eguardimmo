import type { Meta, StoryObj } from '@storybook/react-vite';
import { Pencil, Trash2 } from 'lucide-react';
import { IconButton } from './IconButton';

const meta = {
  title: 'Composants/IconButton',
  component: IconButton,
  args: { label: 'Modifier le bien', icon: Pencil },
  argTypes: {
    variant: { control: 'inline-radio', options: ['ghost', 'secondary', 'danger'] },
    size: { control: 'inline-radio', options: ['xs', 'sm'] },
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Discret: Story = {};

export const Secondaire: Story = { args: { variant: 'secondary' } };

export const Danger: Story = { args: { variant: 'danger', label: 'Supprimer le bien', icon: Trash2 } };

export const TresPetit: Story = { args: { size: 'xs' } };

export const Desactive: Story = { args: { disabled: true } };

export const Tailles: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <IconButton {...args} size="xs" />
      <IconButton {...args} size="sm" />
    </div>
  ),
};
