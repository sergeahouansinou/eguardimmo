import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type ComponentProps } from 'react';
import { SegmentedControl } from './SegmentedControl';

function ControlledSegmentedControl(props: ComponentProps<typeof SegmentedControl>) {
  const [value, setValue] = useState(props.value);
  return <SegmentedControl {...props} value={value} onValueChange={setValue} />;
}

const meta = {
  title: 'Composants/SegmentedControl',
  component: SegmentedControl,
  args: {
    label: 'Régime fiscal',
    value: 'reel',
    onValueChange: () => undefined,
    options: [
      { value: 'reel', label: 'Revenus fonciers, réel' },
      { value: 'lmnp', label: 'LMNP, réel' },
      { value: 'micro', label: 'Micro-foncier' },
    ],
  },
  render: (args) => <ControlledSegmentedControl {...args} />,
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};
