import { getSchema } from '@tiptap/react';
import type { Extensions } from '@tiptap/react';
import { Image } from '@tiptap/extension-image';
import type { ImageOptions } from '@tiptap/extension-image';
import { DOMParser as SchemaParser, DOMSerializer } from '@tiptap/pm/model';
import type { Node as SchemaNode, Schema } from '@tiptap/pm/model';
import { StarterKit } from '@tiptap/starter-kit';
import { cidKey, parseHtml } from '../html/cid';
import { isSafeLink } from '../html/formattingLoss';
import { createImageSourceStore } from './imageSourceStore';
import type { ImageSourceStore } from './imageSourceStore';

const CID_ATTRIBUTE = 'data-cid';

/**
 * Seul « cid: » est lu : une image distante ou « data: » collée n’entre jamais dans la page. Le rendu n’écrit pas « src » :
 * TipTap le rejoue sans la vue de nœud au démontage, et le navigateur tenterait de charger « cid: ».
 */
const CampaignImage = Image.extend<ImageOptions & { sources: ImageSourceStore }>({
  addOptions() {
    return { inline: true, allowBase64: false, HTMLAttributes: {}, resize: false as const, sources: createImageSourceStore() };
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const source = element.getAttribute('src');
          return cidKey(source) === null ? `cid:${element.getAttribute(CID_ATTRIBUTE) ?? ''}` : source;
        },
        renderHTML: (attributes: Record<string, unknown>) => ({
          [CID_ATTRIBUTE]: cidKey(typeof attributes.src === 'string' ? attributes.src : null),
        }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'img[src^="cid:"]' }, { tag: `img[${CID_ATTRIBUTE}]` }];
  },
  addInputRules() {
    return [];
  },
  addNodeView() {
    const { sources } = this.options;
    return ({ node }) => {
      const image = document.createElement('img');
      const attributes = node.attrs as Record<string, unknown>;
      for (const name of ['alt', 'title', 'width', 'height']) {
        const value = attributes[name];
        if (typeof value === 'string' || typeof value === 'number') image.setAttribute(name, String(value));
      }
      const key = cidKey(typeof attributes.src === 'string' ? attributes.src : null);
      const paint = () => {
        const source = key === null ? undefined : sources.get(key);
        if (source === undefined) image.removeAttribute('src');
        else image.setAttribute('src', source);
      };
      paint();
      return { dom: image, destroy: sources.subscribe(paint) };
    };
  },
});

export function campaignExtensions(sources: ImageSourceStore): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      trailingNode: false,
      link: { openOnClick: false, defaultProtocol: 'https', isAllowedUri: isSafeLink },
    }),
    CampaignImage.configure({ sources }),
  ];
}

export function serializeDocument(schema: Schema, content: SchemaNode): string {
  if (content.childCount === 1 && content.firstChild?.type.name === 'paragraph' && content.firstChild.childCount === 0) return '';
  const inert = document.implementation.createHTMLDocument('');
  const container = inert.createElement('div');
  container.appendChild(DOMSerializer.fromSchema(schema).serializeFragment(content.content, { document: inert }));
  return container.innerHTML.replaceAll(`<img ${CID_ATTRIBUTE}="`, '<img src="cid:');
}

export function normalizeHtml(html: string): string {
  const schema = getSchema(campaignExtensions(createImageSourceStore()));
  return serializeDocument(schema, SchemaParser.fromSchema(schema).parse(parseHtml(html).body));
}
