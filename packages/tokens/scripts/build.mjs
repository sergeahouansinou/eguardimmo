import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { emitThemeCss, emitTokensCss } from './emit-css.mjs';
import { emitTokensDart } from './emit-dart.mjs';
import { emitTokensTs } from './emit-ts.mjs';
import { loadModel } from './model.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SRC_DIR = join(root, 'src');
export const GENERATED_DIR = join(root, 'generated');

/**
 * @param {string} [srcDir]
 * @returns {Record<string, string>}
 */
export function buildAll(srcDir = SRC_DIR) {
  const model = loadModel(srcDir);
  return {
    'tokens.css': emitTokensCss(model),
    'theme.css': emitThemeCss(model),
    'tokens.ts': emitTokensTs(model),
    'tokens.dart': emitTokensDart(model),
  };
}

/**
 * @param {string} file
 * @returns {string | null}
 */
function readIfExists(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, string>} outputs
 * @returns {string[]}
 */
export function staleFiles(outputs) {
  return Object.entries(outputs)
    .filter(([name, content]) => readIfExists(join(GENERATED_DIR, name)) !== content)
    .map(([name]) => name);
}

function main() {
  const outputs = buildAll();
  if (process.argv.includes('--check')) {
    const stale = staleFiles(outputs);
    if (stale.length > 0) {
      console.error(`generated/ n'est pas à jour : ${stale.join(', ')}. Lancer « pnpm build ».`);
      process.exit(1);
    }
    console.log('generated/ est à jour.');
    return;
  }
  mkdirSync(GENERATED_DIR, { recursive: true });
  for (const [name, content] of Object.entries(outputs)) {
    writeFileSync(join(GENERATED_DIR, name), content);
  }
  console.log(`generated/ écrit : ${Object.keys(outputs).join(', ')}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
