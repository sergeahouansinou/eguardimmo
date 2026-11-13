import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from './Avatar';

const meta = {
  title: 'Composants/Avatar',
  component: Avatar,
  args: { initials: 'MC', label: 'Marc Chevalier' },
  argTypes: { size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] } },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Petit: Story = {};
export const Moyen: Story = { args: { size: 'md' } };
export const Grand: Story = { args: { size: 'lg' } };
