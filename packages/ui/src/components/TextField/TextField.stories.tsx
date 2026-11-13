import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextField } from './TextField';

const meta = {
  title: 'Composants/TextField',
  component: TextField,
  args: { label: 'Nom du locataire', placeholder: 'Ex. Awa Dossou' },
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const AvecAide: Story = { args: { hint: 'Tel que sur la pièce d’identité' } };

export const EnErreur: Story = {
  args: {
    label: 'E-mail',
    placeholder: 'Ex. nom@exemple.fr',
    defaultValue: 'awa.dossou',
    error: 'Saisissez une adresse e-mail valide',
  },
};

export const Rempli: Story = { args: { defaultValue: 'Awa Dossou' } };

export const Desactive: Story = { args: { disabled: true, defaultValue: 'Awa Dossou' } };

export const LectureSeule: Story = { args: { readOnly: true, defaultValue: 'Awa Dossou' } };
