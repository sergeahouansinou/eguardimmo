'use client';

import { Skeleton } from '@eguardimmo/ui';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import type { ImageSources } from '../useImageSources';
import { campaignExtensions, serializeDocument } from './editorSchema';
import { EditorToolbar } from './EditorToolbar';
import { createImageSourceStore } from './imageSourceStore';
import { LinkDialog } from './LinkDialog';

export type InsertImage = (key: string, alt: string) => void;

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  sources: ImageSources;
  invalid: boolean;
  onReady: (insert: InsertImage | null) => void;
  onPickImage: () => void;
}

const CONTENT_CLASSES =
  'min-h-56 px-3 py-2 text-body break-words focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus ' +
  '[&_p]:my-1.5 [&_h1]:my-2 [&_h1]:text-page-title [&_h2]:my-2 [&_h2]:text-block-title [&_h3]:my-1.5 [&_h3]:text-body-strong ' +
  '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-action [&_a]:underline [&_img]:inline-block [&_img]:max-w-full ' +
  '[&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3';

function applyLink(editor: Editor, url: string): void {
  const chain = editor.chain().focus().extendMarkRange('link');
  if (url === '') chain.unsetLink().run();
  else if (editor.state.selection.empty && !editor.isActive('link')) {
    chain.insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] }).run();
  } else chain.setLink({ href: url }).run();
}

export function RichTextEditor({ value, onChange, sources, invalid, onReady, onPickImage }: RichTextEditorProps) {
  const [store] = useState(createImageSourceStore);
  const [extensions] = useState(() => campaignExtensions(store));
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const emitted = useRef(value);
  const editor = useEditor({
    extensions,
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Contenu de l’e-mail', class: CONTENT_CLASSES },
    },
    onUpdate: ({ editor: current }) => {
      emitted.current = serializeDocument(current.schema, current.state.doc);
      onChange(emitted.current);
    },
  });

  useEffect(() => {
    store.set(sources);
  }, [store, sources]);

  useEffect(() => {
    if (!editor || value === emitted.current) return;
    emitted.current = value;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    onReady((key, alt) => { editor.chain().focus().insertContent({ type: 'image', attrs: { src: `cid:${key}`, alt } }).run(); });
    return () => { onReady(null); };
  }, [editor, onReady]);

  if (!editor) return <Skeleton shape="block" className="h-64" />;
  return (
    <div data-invalid={invalid || undefined} className="min-w-0 rounded-sm border border-line-control bg-surface data-invalid:border-danger-solid">
      <EditorToolbar
        editor={editor}
        onImage={onPickImage}
        onLink={() => {
          const href: unknown = editor.getAttributes('link').href;
          setLinkFrom(typeof href === 'string' ? href : '');
        }}
      />
      <EditorContent editor={editor} />
      {linkFrom === null ? null : <LinkDialog initial={linkFrom} onApply={(url) => { applyLink(editor, url); }} onClose={() => { setLinkFrom(null); }} />}
    </div>
  );
}
