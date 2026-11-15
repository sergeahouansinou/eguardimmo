import type { Meta, StoryObj } from '@storybook/react-vite';
import { Chip } from './Chip';

const meta = {
  title: 'Composants/Chip',
  component: Chip,
  args: { children: 'Loué', pressed: false },
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Repos: Story = {};
export const Pressé: Story = { args: { pressed: true } };
