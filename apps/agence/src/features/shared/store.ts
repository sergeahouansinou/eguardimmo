export interface Store<T> {
  get: () => T;
  update: (change: (current: T) => T) => T;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  return {
    get: () => state,
    update: (change) => {
      state = change(state);
      return state;
    },
  };
}

export function slugify(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function nextId(prefix: string, existing: readonly string[]): string {
  const used = new Set(existing);
  let index = existing.length + 1;
  while (used.has(`${prefix}-${String(index)}`)) index += 1;
  return `${prefix}-${String(index)}`;
}
