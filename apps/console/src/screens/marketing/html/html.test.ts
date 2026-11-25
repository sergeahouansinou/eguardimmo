import { describe, expect, it } from 'vitest';
import { citedImageKeys, imageTag, previewDocument, removeImageTags } from './cid';
import { losesFormatting } from './formattingLoss';

describe('images « cid: » du HTML', () => {
  it('relève les seules images citées', () => {
    expect(Array.from(citedImageKeys('<p><img src="cid:img-1"><img src=cid:img-2><img src="https://x.example/a.png"> cid:img-3</p>'))).toEqual(['img-1', 'img-2']);
  });

  it('retire les balises d’une image sans reformater le reste du code', () => {
    const source = '<table>\n  <tr><td><img alt="a > b" src="cid:img-1"></td></tr>\n</table>\n<IMG SRC=\'cid:img-10\'>';

    expect(removeImageTags(source, 'img-1')).toBe('<table>\n  <tr><td></td></tr>\n</table>\n<IMG SRC=\'cid:img-10\'>');
  });

  it('échappe le texte alternatif inséré', () => {
    expect(imageTag('img-1', 'a" onerror="x<>.png')).toBe('<img src="cid:img-1" alt="a&quot; onerror=&quot;x&lt;&gt;.png">');
  });

  it('prépare un aperçu fermé : images en « data: », aucune redirection, politique restrictive', () => {
    const page = previewDocument(
      '<meta http-equiv="refresh" content="0;url=https://piege.example"><base href="https://piege.example/"><p><img src="cid:img-1"><img src="cid:absente"></p>',
      { 'img-1': 'data:image/png;base64,AAAA' },
    );
    const parsed = new DOMParser().parseFromString(page, 'text/html');

    expect(page.startsWith('<!doctype html>')).toBe(true);
    expect(Array.from(parsed.querySelectorAll('img'), (image) => image.getAttribute('src'))).toEqual(['data:image/png;base64,AAAA', 'cid:absente']);
    expect(Array.from(parsed.querySelectorAll('meta[http-equiv]'), (meta) => meta.getAttribute('content'))).toEqual(["default-src 'none'; img-src data:; style-src 'unsafe-inline'"]);
    expect(parsed.querySelector('base')).toBeNull();
  });
});

describe('détection de la mise en forme que l’éditeur perdrait', () => {
  it.each([
    '',
    '<h1>Titre</h1><p><strong>Gras</strong> <em>italique</em> <u>souligné</u><br></p><ul><li><p>un</p></li></ul><ol start="3"><li>trois</li></ol>',
    '<p><a href="https://eguardimmo.com/aide" target="_blank" rel="noopener">Aide</a> <img src="cid:img-1" alt="x" width="200"></p>',
  ])('conserve %s', (html) => {
    expect(losesFormatting(html)).toBe(false);
  });

  it.each([
    '<table><tr><td>a</td></tr></table>',
    '<p style="color:red">a</p>',
    '<p class="x">a</p>',
    '<div>a</div>',
    '<style>p{}</style><p>a</p>',
    '<!-- note --><p>a</p>',
    '<body bgcolor="red"><p>a</p></body>',
    '<h4>a</h4>',
    '<p><img src="https://x.example/a.png"></p>',
    '<p><img src="data:image/png;base64,AAAA"></p>',
    '<p><a href="javascript:alert(1)">a</a></p>',
    '<p><img src="cid:a" onerror="alert(1)"></p>',
    '<constructor>a</constructor>',
  ])('signale %s', (html) => {
    expect(losesFormatting(html)).toBe(true);
  });
});
