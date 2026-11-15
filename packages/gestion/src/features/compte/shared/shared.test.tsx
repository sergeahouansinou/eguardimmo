import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { addDays, formatDate, formatDateTimeOffset, formatDay, formatTime, isoDay } from './dates';
import { csvCell, downloadFile, toCsv } from './download';
import { Toggle } from './Toggle';

describe('dates', () => {
  it('formate en heure de Paris, hiver et été', () => {
    expect(formatDate('2026-11-13T14:52:07+01:00')).toBe('13/11/2026');
    expect(formatTime('2026-11-13T14:52:07+01:00')).toBe('14:52');
    expect(formatDateTimeOffset('2026-11-13T14:52:07+01:00')).toBe('13/11/2026 14:52:07 UTC+1');
    expect(formatDateTimeOffset('2026-07-13T14:52:07+02:00')).toBe('13/07/2026 14:52:07 UTC+2');
  });

  it('ramène un instant à son jour parisien et calcule des jours', () => {
    expect(isoDay('2026-11-12T23:30:00Z')).toBe('2026-11-13');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(formatDay('2026-11-13')).toBe('13/11/2026');
    expect(() => formatDate('pas-une-date')).toThrow(RangeError);
  });
});

describe('CSV', () => {
  it('échappe guillemets, séparateurs et sauts de ligne', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('dit "oui"')).toBe('"dit ""oui"""');
    expect(csvCell('simple')).toBe('simple');
  });

  it('neutralise les formules de tableur', () => {
    for (const dangerous of ['=1+1', '+33', '-2', '@SUM(A1)']) expect(csvCell(dangerous)).toBe(`'${dangerous}`);
  });

  it('produit un fichier avec BOM et fins de ligne CRLF', () => {
    expect(toCsv([['a', 'b'], ['1', '2']])).toBe('﻿a;b\r\n1;2\r\n');
  });

  it('déclenche un téléchargement puis libère l’URL', () => {
    const revoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    downloadFile('fichier.csv', 'a', 'text/csv');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:x');
    expect(document.querySelector('a[download]')).toBeNull();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
});

describe('Toggle', () => {
  it('bascule au clic et expose son état', async () => {
    function Harness() {
      const [on, setOn] = useState(false);
      return <Toggle label="Mode expert" checked={on} onCheckedChange={setOn} />;
    }
    const { container } = render(<Harness />);
    const toggle = screen.getByRole('switch', { name: 'Mode expert' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    await expectNoA11yViolations(container);
  });

  it('ne réagit pas quand il est désactivé', async () => {
    const change = vi.fn();
    render(<Toggle label="X" checked={false} onCheckedChange={change} disabled />);
    await userEvent.click(screen.getByRole('switch', { name: 'X' }));
    expect(change).not.toHaveBeenCalled();
  });
});
