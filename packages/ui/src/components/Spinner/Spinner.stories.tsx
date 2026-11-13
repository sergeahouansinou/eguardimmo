import type { Meta, StoryObj } from '@storybook/react-vite';
import { Spinner } from './Spinner';

const meta = {
  title: 'Composants/Spinner',
  component: Spinner,
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const Libelle: Story = {
  args: { label: 'Chargement des transactions' },
};

export const CouleurCourante: Story = {
  render: () => (
    <div className="inline-flex rounded-md bg-action p-2 text-on-action">
      <Spinner decorative tone="current" />
    </div>
  ),
};

export const Tailles: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner size={16} />
      <Spinner size={20} />
      <Spinner size={32} />
    </div>
  ),
};
