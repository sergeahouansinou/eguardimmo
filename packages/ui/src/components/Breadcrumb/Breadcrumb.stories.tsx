import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps } from 'react';
import { Breadcrumb } from './Breadcrumb';

function StoryLink({ children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a {...props}>{children}</a>;
}

const meta = {
  title: 'Composants/Breadcrumb',
  component: Breadcrumb,
  args: {
    Link: StoryLink,
    items: [{ label: 'Messages', href: '/messages' }, { label: 'Merci de confirmer le virement' }],
  },
} satisfies Meta<typeof Breadcrumb>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const TroisNiveaux: Story = {
  args: {
    items: [
      { label: 'Support', href: '/support' },
      { label: 'Tickets', href: '/support/tickets' },
      { label: 'SUP-2094' },
    ],
  },
};
