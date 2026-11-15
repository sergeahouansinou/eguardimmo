import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConfirmDialog } from './ConfirmDialog';

const meta = {
  title: 'Composants/ConfirmDialog',
  component: ConfirmDialog,
  args: {
    open: true,
    onOpenChange: () => undefined,
    onConfirm: () => undefined,
    title: 'Passer en irrécouvrable ?',
    description: 'La créance sort des impayés. Elle reste consultable dans le grand livre.',
    confirmLabel: 'Passer en irrécouvrable',
    tone: 'danger',
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Danger: Story = {};
export const Neutre: Story = { args: { tone: 'default', title: 'Envoyer la relance ?', confirmLabel: 'Envoyer' } };
