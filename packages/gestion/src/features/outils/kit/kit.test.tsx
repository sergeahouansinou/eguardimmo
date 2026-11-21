import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { TestLink } from '../../../../test/render';
import { createCollection, NotFoundError, slugify } from './collection';
import { Checkbox, FilterChip, Segmented, Switch } from './controls';
import { DataTable, Td } from './DataTable';
import { ConfirmDialog } from './ConfirmDialog';
import { dismissFlash, pushFlash } from './flash';
import { PageHeader } from './PageHeader';
import { QueryState } from './QueryState';

describe('createCollection', () => {
  it('ajoute, modifie et supprime sans exposer l’état interne', async () => {
    const items = createCollection([{ id: 'a', name: 'Alpha' }]);
    await items.add({ id: 'b', name: 'Bravo' });
    expect((await items.list()).map((item) => item.id)).toEqual(['b', 'a']);
    expect(await items.update('a', { name: 'Alpha 2' })).toEqual({ id: 'a', name: 'Alpha 2' });
    const copy = await items.get('a');
    if (copy) copy.name = 'modifié hors source';
    expect((await items.get('a'))?.name).toBe('Alpha 2');
    await items.remove('b');
    expect(await items.get('b')).toBeUndefined();
  });

  it('refuse de modifier ou supprimer un identifiant inconnu', async () => {
    const items = createCollection([{ id: 'a' }]);
    await expect(items.update('x', {})).rejects.toBeInstanceOf(NotFoundError);
    await expect(items.remove('x')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('produit des identifiants en kebab-case sans accents', () => {
    expect(slugify('Anaïs Roux')).toBe('anais-roux');
    expect(slugify('Apt A1')).toBe('apt-a1');
  });
});

describe('contrôles', () => {
  it('bascule un interrupteur au clic sur le bouton ou sur son libellé', async () => {
    function Harness() {
      const [on, setOn] = useState(false);
      return <Switch checked={on} onCheckedChange={setOn} label="Comparer à N-1" />;
    }
    const { container } = render(<Harness />);
    const toggle = screen.getByRole('switch', { name: 'Comparer à N-1' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    await expectNoA11yViolations(container);
  });

  it('change de valeur au clavier dans le groupe segmenté', async () => {
    const onChange = vi.fn();
    render(
      <Segmented
        label="Période"
        value="12m"
        onValueChange={onChange}
        options={[
          { value: '3m', label: '3 mois' },
          { value: '12m', label: '12 mois' },
        ]}
      />,
    );
    screen.getByRole('radio', { name: '12 mois' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalledWith('3m');
  });

  it('expose l’état pressé d’un filtre et coche une case', async () => {
    const onPressed = vi.fn();
    const onChecked = vi.fn();
    render(
      <>
        <FilterChip pressed={false} onPressedChange={onPressed}>Locations</FilterChip>
        <Checkbox checked={false} onCheckedChange={onChecked} label="Tout sélectionner" />
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Locations' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Tout sélectionner' }));
    expect(onPressed).toHaveBeenCalledWith(true);
    expect(onChecked).toHaveBeenCalledWith(true);
  });
});

describe('ConfirmDialog', () => {
  it('demande confirmation avant l’action destructive', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog open onOpenChange={() => undefined} title="Supprimer l’événement ?" description="Action définitive." confirmLabel="Supprimer" onConfirm={onConfirm} />,
    );
    expect(screen.getByRole('dialog', { name: 'Supprimer l’événement ?' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('PageHeader et message de succès', () => {
  it('affiche fil d’ariane, titre et le message de succès poussé avant la navigation', async () => {
    render(<PageHeader Link={TestLink} crumbs={[{ label: 'Outils', href: '/outils' }, { label: 'Rapports' }]} title="Rapports" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Rapports' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Outils' }).getAttribute('href')).toBe('/outils');
    act(() => { pushFlash('Événement créé.'); });
    expect(screen.getByRole('status').textContent).toContain('Événement créé.');
    await userEvent.click(screen.getByRole('button', { name: 'Fermer le message' }));
    expect(screen.queryByRole('status')).toBeNull();
    dismissFlash();
  });
});

describe('DataTable', () => {
  it('donne aux liens de cellule une zone cliquable d’au moins 24 px', () => {
    render(
      <DataTable caption="Baux">
        <tbody>
          <tr>
            <Td>
              <a href="/baux/1">Bail 1</a>
            </Td>
          </tr>
        </tbody>
      </DataTable>,
    );
    const cell = screen.getByRole('link', { name: 'Bail 1' }).closest('td');
    expect(cell?.className).toContain('[&_a]:min-h-6');
    expect(cell?.className).toContain('[&_a]:py-1.5');
  });

  it('rend la zone de défilement atteignable au clavier', () => {
    render(
      <DataTable caption="Membres de l'équipe">
        <tbody>
          <tr>
            <Td>Camille</Td>
          </tr>
        </tbody>
      </DataTable>,
    );
    const region = screen.getByRole('region', { name: "Membres de l'équipe, défilement horizontal" });
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(region.querySelector('table')).not.toBeNull();
  });

  it('laisse le titre d’une page se couper quand le texte est long', () => {
    render(<PageHeader Link={TestLink} crumbs={[{ label: 'Outils' }]} title="Référence-sans-espace" description="Texte" />);
    expect(screen.getByRole('heading', { level: 1 }).className).toContain('[overflow-wrap:anywhere]');
  });
});

describe('QueryState', () => {
  const base = { isError: false, isPending: false, refetch: vi.fn() };
  it('distingue chargement, erreur avec relance et données', async () => {
    const { rerender } = render(<QueryState query={{ ...base, data: undefined, isPending: true }} errorTitle="Échec">{() => <p>ok</p>}</QueryState>);
    expect(screen.getByRole('status', { name: 'Chargement' })).toBeTruthy();
    rerender(<QueryState query={{ ...base, data: undefined, isError: true }} errorTitle="Échec">{() => <p>ok</p>}</QueryState>);
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(base.refetch).toHaveBeenCalledTimes(1);
    rerender(<QueryState query={{ ...base, data: 1 }} errorTitle="Échec">{() => <p>ok</p>}</QueryState>);
    expect(screen.getByText('ok')).toBeTruthy();
  });
});
