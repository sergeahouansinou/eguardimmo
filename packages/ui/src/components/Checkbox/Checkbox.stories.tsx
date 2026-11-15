import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox } from './Checkbox';

const meta = {
  title: 'Composants/Checkbox',
  component: Checkbox,
  args: { label: 'Envoyer le reçu au locataire' },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};
export const Cochee: Story = { args: { defaultChecked: true } };
export const Desactivee: Story = { args: { disabled: true } };
export const LibelleMasque: Story = { args: { label: 'Sélectionner la ligne', hideLabel: true } };
