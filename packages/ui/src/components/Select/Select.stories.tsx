import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Select } from './Select';

const options = [
  { value: 'haute', label: 'Haute' },
  { value: 'normale', label: 'Normale', description: 'Délai standard' },
  { value: 'basse', label: 'Basse' },
];

const meta = {
  title: 'Composants/Select',
  component: Select,
  args: {
    label: 'Priorité',
    placeholder: 'Choisir une priorité',
    options,
    value: '',
    onValueChange: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="min-h-64 max-w-xs">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

function Controlled(args: Story['args'] & { searchable?: boolean }) {
  const [value, setValue] = useState('');
  return <Select label="Priorité" placeholder="Choisir une priorité" options={options} {...args} value={value} onValueChange={setValue} />;
}

export const Defaut: Story = { render: (args) => <Controlled {...args} /> };

export const AvecRecherche: Story = {
  render: (args) => <Controlled {...args} searchable searchPlaceholder="Rechercher une priorité" />,
};

export const EnErreur: Story = { args: { error: 'Priorité requise' } };

export const Desactive: Story = { args: { disabled: true, value: 'haute' } };
