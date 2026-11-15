import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ComponentProps } from 'react';
import { RadioGroup } from './RadioGroup';

const options = [
  { value: 'electrique', label: 'Électrique' },
  { value: 'gaz', label: 'Gaz' },
  { value: 'pac', label: 'Pompe à chaleur' },
];

const meta = {
  title: 'Composants/RadioGroup',
  component: RadioGroup,
  args: { label: 'Chauffage', options, value: 'electrique', onValueChange: () => undefined },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

function Controlled(args: ComponentProps<typeof RadioGroup>) {
  const [value, setValue] = useState(args.value);
  return <RadioGroup {...args} value={value} onValueChange={setValue} />;
}

export const Simple: Story = {
  render: (args) => <Controlled {...args} />,
};
