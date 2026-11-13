import type { Meta, StoryObj } from '@storybook/react-vite';
import { Alert } from './Alert';

const meta = {
  title: 'Composants/Alert',
  component: Alert,
  args: { children: 'Le bail a bien été enregistré.' },
  argTypes: {
    tone: { control: 'inline-radio', options: ['info', 'success', 'warning', 'danger'] },
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Information: Story = { args: { tone: 'info' } };

export const Succes: Story = { args: { tone: 'success' } };

export const Avertissement: Story = {
  args: { tone: 'warning', children: 'Le loyer de novembre n’est pas encore réglé.' },
};

export const Danger: Story = {
  args: { tone: 'danger', children: 'L’envoi de la quittance a échoué.' },
};

export const AvecTitre: Story = {
  args: {
    tone: 'warning',
    title: 'Loyer en retard',
    children: 'Relancez le locataire avant le 5 du mois.',
  },
};
