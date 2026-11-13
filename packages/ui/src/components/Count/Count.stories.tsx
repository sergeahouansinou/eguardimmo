import type { Meta, StoryObj } from '@storybook/react-vite';
import { Count } from './Count';

const meta = {
  title: 'Composants/Count',
  component: Count,
  args: { value: 7 },
  argTypes: { tone: { control: 'inline-radio', options: ['neutral', 'active', 'accent'] } },
} satisfies Meta<typeof Count>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutre: Story = {};
export const Actif: Story = { args: { tone: 'active' } };
export const Accent: Story = { args: { tone: 'accent' } };
