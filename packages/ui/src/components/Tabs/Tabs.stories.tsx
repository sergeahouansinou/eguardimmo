import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tab, TabList, TabPanel, Tabs } from './Tabs';

const meta = { title: 'Composants/Tabs', component: Tabs, args: { defaultValue: 'tout', children: null } } satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

const render: Story['render'] = (args) => (
  <Tabs {...args}>
    <TabList aria-label="Filtrer les actions">
      <Tab value="tout" count={7}>Tout</Tab>
      <Tab value="finances" count={2}>Finances</Tab>
      <Tab value="baux" count={2}>Baux</Tab>
    </TabList>
    <TabPanel value="tout">Toutes les actions</TabPanel>
    <TabPanel value="finances">Actions finances</TabPanel>
    <TabPanel value="baux">Actions baux</TabPanel>
  </Tabs>
);

export const Moyen: Story = { render };
export const Petit: Story = { render, args: { size: 'sm' } };
