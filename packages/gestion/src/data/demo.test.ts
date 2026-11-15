import { shellSchema } from '@eguardimmo/shell';
import { describe, expect, it } from 'vitest';
import { createDemoSource, demoBureau, demoShell } from './demo';
import { bureauSchema } from './schemas';

describe('données de démonstration', () => {
  it('respectent les contrats', () => {
    expect(() => bureauSchema.parse(demoBureau)).not.toThrow();
    expect(() => shellSchema.parse(demoShell)).not.toThrow();
  });

  it('reproduisent les totaux du design', () => {
    const urgent = demoBureau.todos.filter((todo) => todo.urgent).length;
    expect(demoBureau.todos).toHaveLength(7);
    expect(urgent).toBe(2);
    expect(demoBureau.rentHistory.at(-1)).toEqual({ month: '2026-11', called: 889_000, collected: 777_000 });
  });

  it('marquent les notifications comme lues sans toucher aux données d’origine', async () => {
    const source = createDemoSource();
    await source.markAllNotificationsRead();
    const shell = shellSchema.parse(await source.shell());
    expect(shell.notifications.every((item) => !item.unread)).toBe(true);
    expect(demoShell.notifications.some((item) => item.unread)).toBe(true);
  });
});

describe('contrats', () => {
  it('refusent un montant décimal', () => {
    const invalide = { ...demoBureau, collection: { called: 10.5, collected: 0 } };
    expect(bureauSchema.safeParse(invalide).success).toBe(false);
  });

  it('refusent un lien externe dans une action', () => {
    const todo = demoBureau.todos[0];
    if (!todo) throw new Error('fixture vide');
    const invalide = { ...demoBureau, todos: [{ ...todo, action: { label: 'Voir', href: 'https://exemple.test' } }] };
    expect(bureauSchema.safeParse(invalide).success).toBe(false);
  });
});
