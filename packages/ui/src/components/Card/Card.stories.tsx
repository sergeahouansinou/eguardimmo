import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '../Badge/Badge';
import { Card, CardContent, CardHeader, CardTitle } from './Card';

const meta = {
  title: 'Composants/Card',
  component: Card,
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Loyers du mois</CardTitle>
      </CardHeader>
      <CardContent>12 quittances émises, 2 en attente de règlement.</CardContent>
    </Card>
  ),
};

export const AvecBadge: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Bail Awa Dossou</CardTitle>
        <Badge tone="success">Actif</Badge>
      </CardHeader>
      <CardContent>Appartement 3 pièces, Cotonou.</CardContent>
    </Card>
  ),
};
