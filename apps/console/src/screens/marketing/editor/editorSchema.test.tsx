import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@eguardimmo/ui';
import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { richEditor, stubLayout } from '../testSupport';
import { normalizeHtml } from './editorSchema';
import { RichTextEditor } from './RichTextEditor';
import type { InsertImage } from './RichTextEditor';

const HOSTILE =
  '<p onclick="window.__xss=1">Bonjour</p><img src=x onerror="window.__xss=1"><script>window.__xss=1</script>' +
  '<img src="https://pistage.example/pixel.gif"><img src="data:image/png;base64,AAAA"><iframe src="https://piege.example"></iframe>' +
  '<p><a href="javascript:window.__xss=1">piège</a> <img src="cid:img-1" alt="Bandeau" onload="window.__xss=1"></p>';

const hostileNodes = () =>
  Array.from(document.body.querySelectorAll('*')).filter(
    (element) =>
      element.getAttributeNames().some((name) => name.startsWith('on')) ||
      ['script', 'iframe'].includes(element.localName) ||
      /^(?:x$|https?:|javascript:)/.test(element.getAttribute('src') ?? element.getAttribute('href') ?? ''),
  );

function mount(value: string, sources: Record<string, string> = {}) {
  const onChange = vi.fn<(html: string) => void>();
  let insert: InsertImage | null = null;
  const { unmount } = render(
    <TooltipProvider>
      <RichTextEditor value={value} onChange={onChange} sources={sources} invalid={false} onReady={(next) => { insert = next; }} onPickImage={() => undefined} />
    </TooltipProvider>,
    { wrapper: StrictMode },
  );
  return { onChange, unmount, insert: (key: string) => { insert?.(key, key); } };
}

beforeAll(stubLayout);

describe('assainissement par le schéma de l’éditeur', () => {
  it('ne garde ni gestionnaire, ni script, ni image distante ou « data: », ni lien « javascript: »', () => {
    const clean = normalizeHtml(HOSTILE);

    expect(clean).toContain('Bonjour');
    expect(clean).toContain('src="cid:img-1"');
    expect(clean).not.toMatch(/onerror|onclick|onload|<script|<iframe|pistage|data:image|javascript:|src="x"/);
  });

  it('conserve titres, listes, soulignement et liens sûrs', () => {
    const html = '<h2>Titre</h2><ul><li><p><u>un</u></p></li></ul><p><a href="https://eguardimmo.com/aide">Aide</a></p>';

    expect(normalizeHtml(html)).toContain('<h2>Titre</h2><ul><li><p><u>un</u></p></li></ul>');
    expect(normalizeHtml(html)).toContain('href="https://eguardimmo.com/aide"');
  });

  it('n’insère rien d’actif dans la page au chargement et affiche l’image depuis sa source locale', async () => {
    const view = mount(HOSTILE, { 'img-1': 'data:image/png;base64,AAAA' });
    const editor = await richEditor();

    await waitFor(() => { expect(screen.getByAltText('Bandeau').getAttribute('src')).toBe('data:image/png;base64,AAAA'); });
    expect(editor.querySelectorAll('img:not(.ProseMirror-separator)')).toHaveLength(1);
    expect(hostileNodes()).toEqual([]);
    expect(Reflect.get(window, '__xss')).toBeUndefined();
    expect(view.onChange).not.toHaveBeenCalled();
  });

  it('émet le HTML avec « cid: » après une insertion, sans source locale', async () => {
    const view = mount('<p>Bonjour</p>', { 'img-2': 'data:image/png;base64,BBBB' });
    await richEditor();

    view.insert('img-2');

    await waitFor(() => { expect(view.onChange).toHaveBeenCalled(); });
    const html = view.onChange.mock.lastCall?.[0] ?? '';
    expect(html).toContain('<img src="cid:img-2" alt="img-2">');
    expect(html).not.toContain('data:');
  });

  it('ne pose jamais « cid: » comme source dans la page, même quand l’éditeur est démonté', async () => {
    const writes = vi.spyOn(Element.prototype, 'setAttribute');
    const view = mount('<p>Bonjour <img src="cid:img-1" alt="Bandeau"></p>');
    await richEditor();

    view.unmount();

    const loaded = writes.mock.calls.filter((call, index) => {
      const value: unknown = call[1];
      const target = writes.mock.contexts[index];
      return String(value).startsWith('cid:') && target instanceof Element && target.ownerDocument === document;
    });
    writes.mockRestore();
    expect(loaded).toEqual([]);
  });

  it('annule puis rétablit la mise en forme', async () => {
    const view = mount('<p>Bonjour</p>');
    await richEditor();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Titre de niveau 1' }));
    expect(view.onChange).toHaveBeenLastCalledWith('<h1>Bonjour</h1>');
    await user.click(screen.getByRole('button', { name: 'Annuler la saisie' }));
    expect(view.onChange).toHaveBeenLastCalledWith('<p>Bonjour</p>');
    await user.click(screen.getByRole('button', { name: 'Rétablir la saisie' }));
    expect(view.onChange).toHaveBeenLastCalledWith('<h1>Bonjour</h1>');
  });

  it('refuse un lien qui n’est pas https, mailto ou tel', async () => {
    const view = mount('<p>Bonjour</p>');
    await richEditor();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Lien' }));
    await user.type(await screen.findByRole('textbox', { name: 'Adresse du lien' }), 'javascript:alert(1)');
    await user.click(screen.getByRole('button', { name: 'Appliquer' }));

    expect(await screen.findByText(/Saisissez une adresse commençant par https/)).toBeTruthy();
    expect(view.onChange).not.toHaveBeenCalled();
  });
});
