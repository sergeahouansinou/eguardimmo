# ADR 0012 — Design system partagé

Statut : accepté (2026-11-13). Complète l'ADR 0010.

## Contexte

Six applications web (locataire, propriétaire, agence, SeBook, connexion, console) et une application mobile. Sans source commune, chaque application recrée ses boutons, ses couleurs et ses champs : l'ancien portail a dû migrer 411 boutons dans 153 fichiers vers un composant canonique.

## Décision

### Deux paquets
- **`packages/tokens`** : source unique des jetons, au format JSON des Design Tokens (W3C DTCG). Il couvre couleurs (deux niveaux : palette, puis rôles comme `surface`, `text`, `accent`, `danger`), typographie, espacements, rayons, bordures, durées d'animation, points de rupture. Il génère :
  - des variables CSS et le thème Tailwind 4 (`@theme`) pour le web ;
  - une classe Dart pour l'application Flutter.
- **`packages/ui`** : composants React construits uniquement sur ces jetons. Tout élément réutilisable y vit : bouton, bouton icône avec info-bulle, champs, sélection avec recherche, sélecteur d'entité, date, case, tableau, carte, onglets, assistant par étapes, fenêtre modale, tiroir, toast, fil d'Ariane, état vide, squelette de chargement, édition en place, en-tête de page.

### Identité
- Une seule marque : pétrole dominant, lime en accent, jamais tout en vert. Thèmes clair et sombre.
- Design plat : pas d'ombre portée. La hiérarchie vient du contraste des surfaces et de bordures fines.
- Une application peut ajuster un rôle de jeton (par exemple l'accent de SeBook), jamais redéfinir un composant.

### Règles des composants (reprises des retours sur l'ancien projet)
- Un seul bouton (`Button`, variantes et tailles) ; un bouton icône a toujours une info-bulle du design system et un `aria-label`, jamais `title=`.
- Pas de `<select>` natif : sélection avec recherche. Jamais de champ qui demande un identifiant : sélecteur d'entité par libellé.
- Chaque champ a un `placeholder` concret (exemple ou format).
- Résultat d'une action : toast. Erreur de chargement : alerte dans la page.
- Un champ affiché en lecture s'édite sur place, sans redirection.
- Actions d'une ligne de liste : boutons icône avec info-bulle.
- Accessibilité : RGAA / WCAG 2.1 AA, focus visible, navigation au clavier, contrastes vérifiés sur les deux thèmes.
- Responsive : vérifié à 320 px, 375 px et en bureau, sans défilement horizontal.

### Garde-fous automatiques
- ESLint dans les apps : interdit les couleurs en dur (hexadécimal, `rgb()`, valeurs Tailwind arbitraires comme `bg-[#…]`), le `<select>` natif et l'attribut `title=` sur un bouton.
- Une app n'écrit pas de composant générique : s'il sert à deux endroits, il va dans `packages/ui`.
- **Storybook** dans `packages/ui` : catalogue de chaque composant et de ses états, en clair et en sombre, avec contrôle d'accessibilité automatique (axe).

## Options écartées

- **Une bibliothèque de composants par app** : c'est la duplication que l'on veut éviter.
- **Une bibliothèque externe imposée telle quelle** (MUI, Ant Design) : son identité visuelle et ses ombres combattraient la charte. Des primitives accessibles sans style (Radix, React Aria) restent permises à l'intérieur de `packages/ui`.
- **Jetons écrits à la main en CSS et en Dart** : web et mobile divergeraient.

## Conséquences

- Les apps importent leurs composants depuis `@eguardimmo/ui` et leurs jetons depuis `@eguardimmo/tokens`, rien d'autre pour le style.
- Changer une couleur ou un rayon se fait à un seul endroit et se propage au web et au mobile.
- La première étape front, avant toute page d'application, est le socle de `tokens` et `ui` avec son Storybook.
