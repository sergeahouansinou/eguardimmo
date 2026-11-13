import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button/Button';
import { Dialog, DialogContent, DialogTrigger } from './Dialog';

const meta = { title: 'Composants/Dialog', component: Dialog } satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Centre: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Ouvrir</Button>
      </DialogTrigger>
      <DialogContent title="Confirmer" description="Cette action sera journalisée.">
        <div className="p-4 text-body">Contenu du dialogue.</div>
      </DialogContent>
    </Dialog>
  ),
};

export const FeuilleBasse: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Plus</Button>
      </DialogTrigger>
      <DialogContent title="Plus" placement="bottom">
        <div className="p-4 text-body">Sections secondaires.</div>
      </DialogContent>
    </Dialog>
  ),
};
