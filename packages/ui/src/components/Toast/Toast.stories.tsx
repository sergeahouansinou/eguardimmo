import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button/Button';
import { ToastProvider, useToast } from './Toast';

function Demo() {
  const toast = useToast();
  return <Button onClick={() => { toast.show({ title: 'Lot enregistré', description: 'Apt A3 a été ajouté.' }); }}>Afficher</Button>;
}

const meta = {
  title: 'Composants/Toast',
  component: ToastProvider,
  args: { children: <Demo /> },
} satisfies Meta<typeof ToastProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Succès: Story = {};
