import type { Meta, StoryObj } from '@storybook/react-vite';
import { Inbox } from 'lucide-react';
import { Button } from '../Button/Button';
import { EmptyState } from './EmptyState';

const meta = {
  title: 'Composants/EmptyState',
  component: EmptyState,
  args: { icon: Inbox, title: 'Aucun document', description: 'Importez votre premier document.' },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Simple: Story = {};
export const AvecAction: Story = { args: { children: <Button>Importer</Button> } };
