import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button/Button';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';

const meta = { title: 'Composants/Popover', component: Popover } satisfies Meta<typeof Popover>;

export default meta;

export const Panneau: StoryObj<typeof meta> = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary">Notifications</Button>
      </PopoverTrigger>
      <PopoverContent aria-label="Notifications" className="w-[360px] p-3">
        Aucune notification non lue.
      </PopoverContent>
    </Popover>
  ),
};
