import type { Meta, StoryObj } from '@storybook/react-vite';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from './Table';

const meta = {
  title: 'Composants/Table',
  component: Table,
  args: { 'aria-label': 'Loyers' },
  render: (args) => (
    <Table {...args}>
      <TableHead>
        <tr>
          <TableHeaderCell>Locataire</TableHeaderCell>
          <TableHeaderCell>Bien</TableHeaderCell>
          <TableHeaderCell numeric>Reste dû</TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        <TableRow selected>
          <TableCell strong>Koffi Adjovi</TableCell>
          <TableCell>Apt A1</TableCell>
          <TableCell numeric>850 €</TableCell>
        </TableRow>
        <TableRow>
          <TableCell strong>Clarisse Hounkpatin</TableCell>
          <TableCell>Apt B1</TableCell>
          <TableCell numeric>210 €</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};
