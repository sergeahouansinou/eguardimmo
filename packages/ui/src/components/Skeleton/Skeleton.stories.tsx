import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton } from './Skeleton';

const meta = {
  title: 'Composants/Skeleton',
  component: Skeleton,
  args: { className: 'w-48' },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ligne: Story = {};
export const Bloc: Story = { args: { shape: 'block', className: 'h-24 w-48' } };
export const Cercle: Story = { args: { shape: 'circle' } };
