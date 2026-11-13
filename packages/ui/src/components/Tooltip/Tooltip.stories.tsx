import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button/Button';
import { Tooltip } from './Tooltip';

const meta = {
  title: 'Composants/Tooltip',
  component: Tooltip,
  args: {
    content: 'Exporter la quittance en PDF',
    children: <Button variant="secondary">Survolez-moi</Button>,
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-24 items-center justify-center">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const Ouverte: Story = { args: { defaultOpen: true } };

export const Dessous: Story = { args: { defaultOpen: true, side: 'bottom' } };
