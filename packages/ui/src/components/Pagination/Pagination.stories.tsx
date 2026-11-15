import type { Meta, StoryObj } from '@storybook/react-vite';
import { Pagination } from './Pagination';

const meta = {
  title: 'Composants/Pagination',
  component: Pagination,
  args: { page: 1, pageSize: 10, total: 25, onPageChange: () => undefined },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const UneSeulePage: Story = { args: { total: 9 } };

export const DernierePage: Story = { args: { page: 3 } };
