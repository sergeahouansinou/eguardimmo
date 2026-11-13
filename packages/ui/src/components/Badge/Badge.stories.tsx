import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';

const meta = {
  title: 'Composants/Badge',
  component: Badge,
  args: { children: 'Brouillon' },
  argTypes: {
    tone: { control: 'inline-radio', options: ['neutral', 'info', 'success', 'warning', 'danger'] },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutre: Story = {};

export const Information: Story = { args: { tone: 'info', children: 'En cours' } };

export const Succes: Story = { args: { tone: 'success', children: 'Payé' } };

export const Avertissement: Story = { args: { tone: 'warning', children: 'Partiel' } };

export const Danger: Story = { args: { tone: 'danger', children: 'Impayé' } };

export const Tous: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>Brouillon</Badge>
      <Badge tone="info">En cours</Badge>
      <Badge tone="success">Payé</Badge>
      <Badge tone="warning">Partiel</Badge>
      <Badge tone="danger">Impayé</Badge>
    </div>
  ),
};
