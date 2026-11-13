import type { Meta, StoryObj } from '@storybook/react-vite';
import { CircleAlert, Wallet } from 'lucide-react';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { StatCard } from './StatCard';

const meta = {
  title: 'Composants/StatCard',
  component: StatCard,
  args: { label: 'Encaissé en novembre', value: '4 180 €', icon: Wallet },
  decorators: [(Story) => <div className="w-72"><Story /></div>],
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AvecJauge: Story = {
  args: {
    children: (
      <>
        <ProgressBar value={79} label="79 %" className="my-1" />
        <span className="text-caption text-fg-subtle">sur 5 300 € appelés · 79 %</span>
      </>
    ),
  },
};

export const Negatif: Story = {
  args: {
    label: 'Impayés',
    value: '1 120 €',
    icon: CircleAlert,
    tone: 'danger',
    children: <span className="text-caption text-fg-subtle">3 locataires</span>,
  },
};
