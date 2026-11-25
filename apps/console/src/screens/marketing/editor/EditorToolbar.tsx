'use client';

import { IconButton, cx } from '@eguardimmo/ui';
import { useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { Bold, Heading1, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Redo2, Underline, Undo2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Tool {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  run: () => void;
}

export interface EditorToolbarProps {
  editor: Editor;
  onLink: () => void;
  onImage: () => void;
}

export function EditorToolbar({ editor, onLink, onImage }: EditorToolbarProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      h1: current.isActive('heading', { level: 1 }),
      h2: current.isActive('heading', { level: 2 }),
      h3: current.isActive('heading', { level: 3 }),
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      underline: current.isActive('underline'),
      bullets: current.isActive('bulletList'),
      ordered: current.isActive('orderedList'),
      link: current.isActive('link'),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();
  const tools: Tool[] = [
    { label: 'Titre de niveau 1', icon: Heading1, active: state.h1, run: () => { chain().toggleHeading({ level: 1 }).run(); } },
    { label: 'Titre de niveau 2', icon: Heading2, active: state.h2, run: () => { chain().toggleHeading({ level: 2 }).run(); } },
    { label: 'Titre de niveau 3', icon: Heading3, active: state.h3, run: () => { chain().toggleHeading({ level: 3 }).run(); } },
    { label: 'Gras', icon: Bold, active: state.bold, run: () => { chain().toggleBold().run(); } },
    { label: 'Italique', icon: Italic, active: state.italic, run: () => { chain().toggleItalic().run(); } },
    { label: 'Souligné', icon: Underline, active: state.underline, run: () => { chain().toggleUnderline().run(); } },
    { label: 'Liste à puces', icon: List, active: state.bullets, run: () => { chain().toggleBulletList().run(); } },
    { label: 'Liste numérotée', icon: ListOrdered, active: state.ordered, run: () => { chain().toggleOrderedList().run(); } },
    { label: 'Lien', icon: Link2, active: state.link, run: onLink },
    { label: 'Ajouter une image', icon: ImagePlus, run: onImage },
    { label: 'Annuler la saisie', icon: Undo2, disabled: !state.canUndo, run: () => { chain().undo().run(); } },
    { label: 'Rétablir la saisie', icon: Redo2, disabled: !state.canRedo, run: () => { chain().redo().run(); } },
  ];
  return (
    <div role="group" aria-label="Mise en forme" className="flex flex-wrap gap-1 border-b border-line p-1">
      {tools.map((tool) => (
        <IconButton
          key={tool.label}
          label={tool.label}
          icon={tool.icon}
          aria-pressed={tool.active}
          disabled={tool.disabled}
          className={cx(tool.active && 'bg-action-subtle text-action-on-subtle')}
          onClick={tool.run}
        />
      ))}
    </div>
  );
}
