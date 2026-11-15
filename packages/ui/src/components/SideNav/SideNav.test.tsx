import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Building2, House, Settings, Users } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { BottomNav } from './BottomNav';
import { SideNav } from './SideNav';
import { activeChildHref } from './types';
import type { NavSection } from './types';

const sections: NavSection[] = [
  {
    id: 'principal',
    label: 'Principal',
    entries: [
      { id: 'accueil', label: 'Accueil', href: '/', icon: House },
      {
        id: 'biens',
        label: 'Biens',
        href: '/biens',
        icon: Building2,
        count: 11,
        children: [
          { id: 'lots', label: 'Lots', href: '/biens' },
          { id: 'immeubles', label: 'Immeubles', href: '/biens/immeubles' },
        ],
      },
      { id: 'locataires', label: 'Locataires', href: '/locataires', icon: Users, count: 10 },
    ],
  },
];
const footer = [{ id: 'reglages', label: 'Réglages', href: '/reglages', icon: Settings }];

describe('SideNav déplié', () => {
  it('marque la page courante et compte les entrées', () => {
    render(<SideNav label="Navigation principale" sections={sections} footer={footer} currentPath="/" />);
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(within(nav).getByRole('link', { name: 'Accueil' }).getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByRole('link', { name: /Locataires/ }).textContent).toContain('10');
    expect(within(nav).getByRole('link', { name: 'Réglages' })).toBeTruthy();
  });

  it('ouvre le sous-menu d’une entrée parente', async () => {
    render(<SideNav label="Navigation" sections={sections} currentPath="/" />);
    const parent = screen.getByRole('button', { name: /Biens/ });
    expect(parent.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(parent);
    expect(parent.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('link', { name: 'Immeubles' }).getAttribute('href')).toBe('/biens/immeubles');
  });

  it('déplie d’office le parent de la page courante', () => {
    render(<SideNav label="Navigation" sections={sections} currentPath="/biens/immeubles" />);
    expect(screen.getByRole('button', { name: /Biens/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('link', { name: 'Immeubles' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Lots' }).getAttribute('aria-current')).toBeNull();
  });

  it('replie un groupe par son intitulé', async () => {
    render(<SideNav label="Navigation" sections={sections} currentPath="/" />);
    await userEvent.click(screen.getByRole('button', { name: 'Principal' }));
    expect(screen.queryByRole('link', { name: 'Accueil' })).toBeNull();
  });

  it('n’a aucune violation axe', async () => {
    const { container } = render(
      <SideNav label="Navigation" sections={sections} footer={footer} currentPath="/biens" />,
    );
    await expectNoA11yViolations(container);
  });
});

describe('SideNav replié', () => {
  it('nomme chaque icône et ouvre les sous-pages dans un volet', async () => {
    render(<SideNav label="Navigation" sections={sections} currentPath="/" collapsed />);
    expect(screen.getByRole('link', { name: 'Accueil' }).getAttribute('aria-current')).toBe('page');
    await userEvent.click(screen.getByRole('button', { name: 'Biens' }));
    const volet = await screen.findByRole('dialog', { name: 'Biens' });
    expect(within(volet).getByRole('link', { name: 'Immeubles' })).toBeTruthy();
  });

  it('n’a aucune violation axe', async () => {
    const { container } = render(
      <SideNav label="Navigation" sections={sections} footer={footer} currentPath="/" collapsed />,
    );
    await expectNoA11yViolations(container);
  });
});

describe('BottomNav', () => {
  it('marque l’onglet courant et déclenche l’entrée sans lien', async () => {
    let opened = false;
    render(
      <BottomNav
        label="Navigation mobile"
        currentPath="/locataires"
        items={[
          { id: 'accueil', label: 'Accueil', icon: House, href: '/' },
          { id: 'locataires', label: 'Locataires', icon: Users, href: '/locataires' },
          { id: 'plus', label: 'Plus', icon: Settings, onSelect: () => { opened = true; } },
        ]}
      />,
    );
    expect(screen.getByRole('link', { name: 'Locataires' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Accueil' }).getAttribute('aria-current')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Plus' }));
    expect(opened).toBe(true);
  });
});

describe('activeChildHref', () => {
  const finances = [
    { id: 'operations', label: 'Opérations', href: '/finances' },
    { id: 'impayes', label: 'Impayés', href: '/finances/impayes', activeFor: ['/finances/recouvrement'] },
  ];

  it('rattache une page sans entrée propre au lien qui la déclare', () => {
    expect(activeChildHref(finances, '/finances/recouvrement/dos-1')).toBe('/finances/impayes');
  });

  it('garde le lien le plus précis par défaut', () => {
    expect(activeChildHref(finances, '/finances/impayes')).toBe('/finances/impayes');
    expect(activeChildHref(finances, '/finances/factures')).toBe('/finances');
  });
});
