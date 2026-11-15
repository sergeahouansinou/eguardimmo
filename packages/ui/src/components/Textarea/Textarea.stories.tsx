import type { Meta, StoryObj } from '@storybook/react-vite';
import { Textarea } from './Textarea';

const meta = {
  title: 'Composants/Textarea',
  component: Textarea,
  args: { label: 'Message', placeholder: 'Ex. Bonjour, le virement est programmé pour le 15.' },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const AvecAide: Story = { args: { hint: 'Vous pouvez joindre des documents après.' } };

export const EnErreur: Story = { args: { error: 'Saisissez votre message' } };

export const Desactive: Story = { args: { disabled: true, defaultValue: 'Message envoyé' } };
