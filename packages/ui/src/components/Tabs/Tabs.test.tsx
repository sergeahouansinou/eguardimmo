import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { Tab, TabList, TabPanel, Tabs } from './Tabs';

function Exemple({ onValueChange }: { onValueChange?: (value: string) => void }) {
  return (
    <Tabs defaultValue="tout" onValueChange={onValueChange}>
      <TabList aria-label="Filtrer">
        <Tab value="tout" count={7}>Tout</Tab>
        <Tab value="finances" count={2}>Finances</Tab>
        <Tab value="baux">Baux</Tab>
      </TabList>
      <TabPanel value="tout">Toutes les actions</TabPanel>
      <TabPanel value="finances">Actions finances</TabPanel>
      <TabPanel value="baux">Actions baux</TabPanel>
    </Tabs>
  );
}

describe('Tabs', () => {
  it('relie l’onglet sélectionné à son panneau', () => {
    render(<Exemple />);
    const tab = screen.getByRole('tab', { name: /Tout/ });
    expect(tab.getAttribute('aria-selected')).toBe('true');
    const panel = screen.getByRole('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe(tab.id);
    expect(tab.getAttribute('aria-controls')).toBe(panel.id);
    expect(screen.getByText('7').className).toContain('bg-action');
  });

  it('change de panneau au clic et notifie', async () => {
    const onValueChange = vi.fn();
    render(<Exemple onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole('tab', { name: /Finances/ }));
    expect(screen.getByRole('tabpanel').textContent).toBe('Actions finances');
    expect(onValueChange).toHaveBeenCalledWith('finances');
  });

  it('se parcourt aux flèches avec un seul arrêt de tabulation', async () => {
    render(<Exemple />);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: /Tout/ }));
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: /Finances/ }));
    expect(screen.getByRole('tabpanel').textContent).toBe('Actions finances');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('tabpanel').textContent).toBe('Actions baux');
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('tabpanel').textContent).toBe('Toutes les actions');
    expect(screen.getAllByRole('tab').filter((tab) => tab.tabIndex === 0)).toHaveLength(1);
  });

  it('n’a aucune violation axe', async () => {
    const { container } = render(<Exemple />);
    await expectNoA11yViolations(container);
  });
});
