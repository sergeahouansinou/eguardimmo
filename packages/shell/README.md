# @eguardimmo/shell

Coquille d'espace partagée (barre du haut, rail latéral, barre mobile + volet « Plus », menu du compte, notifications, recherche ⌘K) et écran « Écran prévu ». Publiée en source TypeScript : chaque app l'ajoute à `transpilePackages` et à `@source` de son `globals.css`.

## Assembler une app d'espace

Modèles à copier : `apps/locataire` et `apps/console` (coquille minimale), `apps/proprietaire` (coquille riche via `@eguardimmo/gestion`).

1. **Config** (`src/espace/config.ts`) : navigation, `bottomItems`, `accountMenu`, `notifications`, écrans prévus, index de recherche.
2. **Source** (`src/espace/demo.ts`) : objet `ShellSource` (`shell()` renvoie un `ShellData`, `markAllNotificationsRead()`), fourni par `<ShellSourceProvider>` dans `providers.tsx`, à côté de `QueryClientProvider` et `TooltipProvider`. Le `shell()` est validé par `shellSchema` : brancher l'API réelle revient à remplacer la source.
3. **Coquille** (`(espace)/EspaceShell.tsx`, client) : `<SpaceShell>` avec `usePathname`, `useRouter().push` et `next/link`. `(espace)/layout.tsx` l'enveloppe dans `<Suspense>` (`usePathname`).
4. **Écrans prévus** (`(espace)/[...ecran]/page.tsx`) : `resolvePlanned(map, segments)`, `plannedStaticParams(map)` et `<PlannedScreen title description />`. Toute route liée mais non livrée doit figurer dans la `Map` href → titre ; un écran réel remplace l'entrée par un vrai `page.tsx` (et sort de la `Map`).

## API de `SpaceShell`

| Prop | Rôle |
|---|---|
| `spaceLabel`, `logoSrc` | pastille d'espace et logo de la barre du haut |
| `currentPath`, `linkComponent`, `onNavigate` | routage injecté (pas de dépendance à Next) |
| `railStorageKey` | clé `localStorage` du rail replié, une par app |
| `navigation` | `{ sections, footer }` ou `(counts) => { sections, footer }` (compteurs de `ShellData.counts`) |
| `bottomItems` | `{ id, label, icon, href }[]` de la barre mobile ; « Plus » est ajouté, et ces `id` sont exclus du volet (ils doivent correspondre aux `id` de la navigation) |
| `accountMenu` | `{ groups, footerItems?, switchSpace?, signOut, roleLabels? }` ; `switchSpace` absent = pas de « Changer d'espace » |
| `notifications` | `{ allHref, settingsHref? }` |
| `searchPages` | index ⌘K `{ href, label }[]` ; `searchPlaceholder?`, `searchNote?` |
| `addMenu?`, `helpMenu?` | bouton « Ajouter » et menu d'aide ; masqués si absents (`HelpMenuItem` : `shortcut?`, `separatorBefore?`) |

Autres exports : `useShellData`, `useMarkAllNotificationsRead`, `shellKeys`, `useAfterHydration`, `useStoredValue`, `useTheme`, `toneTile`, `toneBadge`, `shellSchema`, `hrefSchema`, `toneSchema`.

## Pièges

- `ShellData.counts` est un `Record<string, number>` : les clés sont celles de l'app.
- `workspace.role` est libre ; le libellé affiché vient de `accountMenu.roleLabels`.
- `bottomItems` et `navigation` : mêmes `id` pour les entrées de la barre mobile, sinon elles réapparaissent dans « Plus ».
- Les liens de `href` du schéma sont internes uniquement (`/chemin`).
- Un composant générique manquant va dans `packages/ui`, pas dans l'app.
