import { SRC_DIR } from '../scripts/build.mjs';
import { loadModel } from '../scripts/model.mjs';
import type { Rgba } from './contrast';

export type ThemeName = 'light' | 'dark';

const model = loadModel(SRC_DIR);

export function role(theme: ThemeName, name: string): Rgba {
  const found = model.roles[theme].find((entry) => entry.path.join('.') === name);
  if (found === undefined) throw new Error(`Rôle introuvable : ${theme}/${name}`);
  return found.value;
}

export { model };
