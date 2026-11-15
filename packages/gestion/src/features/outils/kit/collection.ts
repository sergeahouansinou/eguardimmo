export interface Entity {
  id: string;
}

export interface Collection<T extends Entity> {
  list: () => Promise<T[]>;
  get: (id: string) => Promise<T | undefined>;
  add: (item: T) => Promise<T>;
  update: (id: string, patch: Partial<Omit<T, 'id'>>) => Promise<T>;
  remove: (id: string) => Promise<void>;
}

export class NotFoundError extends Error {
  constructor(id: string) {
    super(`Élément introuvable : ${id}`);
    this.name = 'NotFoundError';
  }
}

export function createCollection<T extends Entity>(initial: readonly T[]): Collection<T> {
  let items: T[] = structuredClone([...initial]);
  return {
    list: () => Promise.resolve(structuredClone(items)),
    get: (id) => Promise.resolve(structuredClone(items.find((item) => item.id === id))),
    add: (item) => {
      items = [structuredClone(item), ...items];
      return Promise.resolve(structuredClone(item));
    },
    update: (id, patch) => {
      const current = items.find((item) => item.id === id);
      if (!current) return Promise.reject(new NotFoundError(id));
      const next = { ...current, ...patch };
      items = items.map((item) => (item.id === id ? next : item));
      return Promise.resolve(structuredClone(next));
    },
    remove: (id) => {
      if (!items.some((item) => item.id === id)) return Promise.reject(new NotFoundError(id));
      items = items.filter((item) => item.id !== id);
      return Promise.resolve();
    },
  };
}

export function slugify(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

let sequence = 0;

export function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${String(sequence)}`;
}
