import type { Meta, StoryObj } from '@storybook/react-vite';
import { DateRangeField } from './DateRangeField';

const meta = {
  title: 'Composants/DateRangeField',
  component: DateRangeField,
  args: { legend: 'Période du relevé', from: '2026-11-01', to: '2026-11-30', onFromChange: () => undefined, onToChange: () => undefined },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DateRangeField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const AvecAide: Story = { args: { hint: 'Une période de 366 jours au plus.' } };

export const EnErreur: Story = { args: { from: '2026-12-01', to: '2026-11-01', error: 'La date de fin ne peut pas précéder celle de début.' } };
