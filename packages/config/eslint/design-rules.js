import tseslint from 'typescript-eslint';

const HEX = String.raw`(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])`;
const COLOR_FUNCTION = String.raw`\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(`;
const TAILWIND_ARBITRARY = String.raw`-\[(?:#|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(|color:)|\[color:`;

const onStrings = (pattern) =>
  `Literal[value=/${pattern}/], TemplateElement[value.raw=/${pattern}/]`;

const restricted = [
  {
    selector: 'JSXOpeningElement[name.name="select"]',
    message: 'Utiliser le composant de sélection avec recherche de @eguardimmo/ui.',
  },
  {
    selector: 'JSXOpeningElement[name.name="button"] > JSXAttribute[name.name="title"]',
    message: 'Bouton icône : IconButton avec info-bulle et aria-label.',
  },
  {
    selector: onStrings(HEX),
    message:
      'Couleur hexadécimale en dur interdite : utiliser un rôle de jeton de @eguardimmo/tokens.',
  },
  {
    selector: onStrings(COLOR_FUNCTION),
    message:
      'Couleur en dur interdite (rgb, hsl, oklch…) : utiliser un rôle de jeton de @eguardimmo/tokens.',
  },
  {
    selector: onStrings(TAILWIND_ARBITRARY),
    message:
      'Valeur Tailwind arbitraire de couleur interdite : utiliser une classe issue des rôles de jeton.',
  },
];

/** @type {import('eslint').Linter.Config[]} */
export const designRules = [
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-restricted-syntax': ['error', ...restricted],
    },
  },
];
