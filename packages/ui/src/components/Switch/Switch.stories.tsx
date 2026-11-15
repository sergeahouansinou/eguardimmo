import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type ComponentProps } from 'react';
import { Switch } from './Switch';

function ControlledSwitch(props: ComponentProps<typeof Switch>) {
  const [checked, setChecked] = useState(props.checked);
  return <Switch {...props} checked={checked} onCheckedChange={setChecked} />;
}

const meta = {
  title: 'Composants/Switch',
  component: Switch,
  args: { label: 'Déductible des revenus fonciers', checked: true, onCheckedChange: () => undefined },
  render: (args) => <ControlledSwitch {...args} />,
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {};
export const Inactif: Story = { args: { checked: false } };
export const Desactive: Story = { args: { disabled: true } };
