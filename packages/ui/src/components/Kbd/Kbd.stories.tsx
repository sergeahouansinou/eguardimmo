import type { Meta, StoryObj } from '@storybook/react-vite';
import { Kbd } from './Kbd';

const meta = { title: 'Composants/Kbd', component: Kbd, args: { children: '⌘K' } } satisfies Meta<typeof Kbd>;

export default meta;
export const Raccourci: StoryObj<typeof meta> = {};
