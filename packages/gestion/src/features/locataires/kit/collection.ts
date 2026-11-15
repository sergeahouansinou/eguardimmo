export interface DemoCollection<T extends { id: string }> {
  all: () => T[];
  find: (id: string) => T | undefined;
  add: (item: T) => T;
  patch: (id: string, changes: Partial<T>) => T;
  remove: (id: string) => void;
}

export class NotFoundError extends Error {
  constructor(what: string, id: string) {
    super(`${what} introuvable : ${id}`);
    this.name = 'NotFoundError';
  }
}

export function createCollection<T extends { id: string }>(what: string, initial: readonly T[]): DemoCollection<T> {
  let items: T[] = initial.map((item) => structuredClone(item));
  return {
    all: () => items.map((item) => structuredClone(item)),
    find: (id) => {
      const found = items.find((item) => item.id === id);
      return found ? structuredClone(found) : undefined;
    },
    add: (item) => {
      if (items.some((existing) => existing.id === item.id)) throw new Error(`${what} déjà existant : ${item.id}`);
      items = [...items, structuredClone(item)];
      return structuredClone(item);
    },
    patch: (id, changes) => {
      const index = items.findIndex((item) => item.id === id);
      const current = items[index];
      if (!current) throw new NotFoundError(what, id);
      const next = { ...current, ...changes };
      items = items.map((item, position) => (position === index ? next : item));
      return structuredClone(next);
    },
    remove: (id) => {
      if (!items.some((item) => item.id === id)) throw new NotFoundError(what, id);
      items = items.filter((item) => item.id !== id);
    },
  };
}
