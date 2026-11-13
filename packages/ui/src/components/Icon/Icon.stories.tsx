import type { Meta, StoryObj } from '@storybook/react-vite';
import { Building2 } from 'lucide-react';
import { Icon } from './Icon';

const meta = {
  title: 'Composants/Icon',
  component: Icon,
  args: { icon: Building2 },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const AvecLibelle: Story = { args: { label: 'Immeuble' } };

export const Tailles: Story = {
  render: (args) => (
    <div className="flex items-center gap-4 text-fg-muted">
      <Icon {...args} size={14} />
      <Icon {...args} size={16} />
      <Icon {...args} size={20} />
      <Icon {...args} size={32} />
    </div>
  ),
};
