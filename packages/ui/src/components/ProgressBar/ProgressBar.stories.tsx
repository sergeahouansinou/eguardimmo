import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProgressBar } from './ProgressBar';

const meta = {
  title: 'Composants/ProgressBar',
  component: ProgressBar,
  args: { value: 79, label: '79 %' },
  decorators: [(Story) => <div className="w-60"><Story /></div>],
} satisfies Meta<typeof ProgressBar>;

export default meta;
export const Encaissement: StoryObj<typeof meta> = {};
