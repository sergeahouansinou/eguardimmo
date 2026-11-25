import type { ImageSources } from '../useImageSources';

export interface ImageSourceStore {
  set: (sources: ImageSources) => void;
  get: (key: string) => string | undefined;
  subscribe: (listener: () => void) => () => void;
}

export function createImageSourceStore(): ImageSourceStore {
  let current: ImageSources = {};
  const listeners = new Set<() => void>();
  return {
    set: (sources) => {
      current = sources;
      for (const listener of listeners) listener();
    },
    get: (key) => (Object.hasOwn(current, key) ? current[key] : undefined),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
