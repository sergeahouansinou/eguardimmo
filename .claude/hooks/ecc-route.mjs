#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const REGLES = [
  {
    nom: 'Laravel / backend',
    motifs: /\b(laravel|php|eloquent|backend|api|endpoint|route|controleur|controller|action|form ?request|resource|artisan|pest|phpstan|pint|job|listener|evenement|event)\b/,
    skills: ['ecc:laravel-patterns', 'ecc:laravel-tdd', 'ecc:laravel-verification'],
    agents: ['ecc:php-reviewer (relecture)'],
  },
  {
    nom: 'Module métier',
    motifs: /\b(module|bounded context|contexte metier|queries|publicapi|cloisonnement|organisation|organization)\b/,
    skills: ['ecc:module-governance', 'ecc:change-impact'],
    agents: ['ecc:architect'],
  },
  {
    nom: 'Base de données',
    motifs: /\b(migration|schema|table|colonne|index|sql|mysql|postgres|requete|n\+1)\b/,
    skills: ['ecc:database-migrations', 'ecc:mysql-patterns'],
    agents: ['ecc:database-reviewer'],
  },
  {
    nom: 'Next.js / React',
    motifs: /\b(next|nextjs|react|tsx|composant|component|page|front|frontend|hook|zustand|react query|tanstack|zod|locataire|proprietaire|agence|sebook|console|monorepo|pnpm)\b/,
    skills: ['ecc:nextjs-turbopack', 'ecc:react-patterns', 'ecc:typescript-patterns', 'ecc:react-testing'],
    agents: ['ecc:react-reviewer', 'ecc:typescript-reviewer'],
  },
  {
    nom: 'Design system',
    motifs: /\b(design system|token|jeton|bouton|button|storybook|theme|couleur|tailwind|ui|accessibilite|rgaa|wcag|responsive)\b/,
    skills: ['ecc:design-system', 'ecc:frontend-a11y', 'ecc:accessibility'],
    agents: ['ecc:a11y-architect'],
  },
  {
    nom: 'Sécurité',
    motifs: /\b(securite|security|auth|authentification|connexion|login|mot de passe|password|2fa|totp|otp|jeton d.acces|sanctum|cookie|csrf|cors|csp|idor|permission|droit|role|upload|faille|owasp|rgpd)\b/,
    skills: ['ecc:security-review', 'ecc:laravel-security'],
    agents: ['ecc:security-reviewer'],
    commandes: ['/security-review avant de déclarer prêt'],
  },
  {
    nom: 'Tests',
    motifs: /\b(test|tests|tdd|couverture|coverage|mutation)\b/,
    skills: ['ecc:tdd-workflow'],
    agents: ['ecc:tdd-guide'],
  },
  {
    nom: 'QA navigateur / E2E',
    motifs: /\b(e2e|navigateur|browser|playwright|qa|parcours|teste dans|verifie dans)\b/,
    skills: ['ecc:browser-qa', 'ecc:e2e-testing'],
    agents: ['ecc:e2e-runner'],
  },
  {
    nom: 'Planification / architecture',
    motifs: /\b(plan|planifie|planifier|architecture|adr|conception|concevoir|fonctionnalite|feature|epic|chantier|decoupage)\b/,
    skills: ['ecc:architecture-decision-records', 'ecc:blueprint'],
    agents: ['ecc:planner', 'ecc:architect'],
    commandes: ['/prp-plan <fonctionnalité> puis /prp-implement <plan>'],
  },
  {
    nom: 'Erreur / build cassé',
    motifs: /\b(bug|erreur|error|plante|crash|echoue|echec|cassee?|build|compile|typecheck|exception|500)\b/,
    skills: ['ecc:error-handling'],
    agents: ['ecc:build-error-resolver', 'ecc:react-build-resolver', 'ecc:silent-failure-hunter'],
    commandes: ['/build-fix'],
  },
  {
    nom: 'Flutter / mobile',
    motifs: /\b(flutter|dart|mobile|ios|android)\b/,
    skills: ['ecc:dart-flutter-patterns', 'flutter-architecture'],
    agents: ['ecc:flutter-reviewer', 'ecc:dart-build-resolver'],
  },
  {
    nom: 'Revue de code',
    motifs: /\b(revue|review|relis|relire|relecture|audit)\b/,
    skills: [],
    agents: ['ecc:code-reviewer', 'agent relecteur de la stack touchée'],
    commandes: ['/code-review'],
  },
  {
    nom: 'Commit / git',
    motifs: /\b(commit|commite|git|branche|merge|pr|pull request)\b/,
    skills: ['ecc:conventional-commit-review', 'ecc:git-workflow'],
    agents: ['ecc:commit-reviewer'],
  },
  {
    nom: 'Performance',
    motifs: /\b(perf|performance|lent|lenteur|optimise|optimiser|cache|bundle)\b/,
    skills: ['ecc:redis-patterns'],
    agents: ['ecc:performance-optimizer'],
  },
  {
    nom: 'Refactor / impact',
    motifs: /\b(refactor|refacto|renomme|renommer|deplace|nettoie|code mort|impact)\b/,
    skills: ['ecc:change-impact'],
    agents: ['ecc:refactor-cleaner'],
  },
  {
    nom: 'Documentation de bibliothèque',
    motifs: /\b(documentation|doc officielle|librairie|bibliotheque|package|dependance|version)\b/,
    skills: ['ecc:search-first', 'ecc:documentation-lookup'],
    agents: ['ecc:docs-lookup'],
  },
];

function normaliser(texte) {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

let entree = {};
try {
  entree = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}

const prompt = typeof entree.prompt === 'string' ? entree.prompt.trim() : '';
if (prompt === '' || prompt.startsWith('/')) process.exit(0);

const texte = normaliser(prompt);
const trouvees = REGLES.filter((r) => r.motifs.test(texte));
if (trouvees.length === 0) process.exit(0);

const unique = (liste) => [...new Set(liste)];
const skills = unique(trouvees.flatMap((r) => r.skills));
const agents = unique(trouvees.flatMap((r) => r.agents));
const commandes = unique(trouvees.flatMap((r) => r.commandes ?? []));

const lignes = [
  `Routage ECC (domaines détectés : ${trouvees.map((r) => r.nom).join(', ')}).`,
  skills.length ? `Skills à charger avec l'outil Skill avant d'agir, si la tâche le justifie : ${skills.join(', ')}.` : '',
  agents.length ? `Agents à déléguer (outil Agent) : ${agents.join(', ')}. Collecte en lecture : agent collecte (Haiku) ; code d'un plan validé : agent codeur (Sonnet).` : '',
  commandes.length ? `Commandes à proposer à l'utilisateur : ${commandes.join(' ; ')}.` : '',
  "Tâche triviale ou simple question : ignorer ce routage. Ne jamais charger un skill hors sujet pour cocher la case.",
].filter(Boolean);

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: lignes.join('\n') },
}));
