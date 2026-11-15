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
| `accountMenu` | `{ groups, footerItems?, switchSpace?, signOut, roleLabels? }` ; `switchSpace` absent = pas de « Changer d'espace ». Un `href` absolu (`https://…`, ex. `authUrl('/profils')`) devient un vrai `<a>` ; un chemin interne passe par `onNavigate` |
| `notifications` | `{ allHref, settingsHref? }` |
| `searchPages` | index ⌘K `{ href, label }[]` ; `searchPlaceholder?`, `searchNote?` |
| `addMenu?`, `helpMenu?` | bouton « Ajouter » et menu d'aide ; masqués si absents (`HelpMenuItem` : `shortcut?`, `separatorBefore?`) |

Autres exports : `useShellData`, `useMarkAllNotificationsRead`, `useMarkNotificationRead`, `useCanMarkNotificationRead`, `shellKeys`, `useAfterHydration`, `useStoredValue`, `useTheme`, `toneTile`, `toneBadge`, `shellSchema`, `hrefSchema`, `toneSchema`.

## Centre de notifications (`NotificationsPage`)

Page complète des notifications de `ShellData` : filtres Toutes / Non lues, marquage d'une notification ou de toutes, lien vers l'objet, états chargement / erreur (avec « Réessayer») / vide, pagination au-delà de 20, lien vers les préférences.

| Prop | Rôle |
|---|---|
| `Link` | composant de lien de l'app (`next/link`) : une fonction n'est pas sérialisable, la page de l'app passe donc par un petit composant client |
| `settingsHref?` | lien « Préférences » (absent = pas de lien) |
| `pageSize?` | 20 par défaut |

Convention : le centre vit sur `/notifications` (`/notifications/toutes` quand `/notifications` porte déjà les préférences), et `notifications.allHref` pointe dessus.

Le marquage d'une seule notification demande `ShellSource.markNotificationRead(id)`, **optionnel** : sans lui, seul « Tout marquer comme lu » est proposé. Les sources de démo locataire, console, propriétaire (bailleur et mandant) et agence l'implémentent.

## Liens entre applications (`spaceUrls`)

`authUrl(path)` et `spaceUrl('locataire' | 'proprietaire' | 'agence', path)` composent des adresses absolues vers une autre application (le chemin doit être interne : `/…`, sans `//` ni schéma). Les liens sortants sont de vrais `<a>`, jamais `next/link`.

| Variable (lue au build, `NEXT_PUBLIC_*`) | Défaut en développement |
|---|---|
| `NEXT_PUBLIC_AUTH_URL` | `http://localhost:3040` |
| `NEXT_PUBLIC_LOCATAIRE_URL` | `http://localhost:3030` |
| `NEXT_PUBLIC_PROPRIETAIRE_URL` | `http://localhost:3020` |
| `NEXT_PUBLIC_AGENCE_URL` | `http://localhost:3010` |

- Valeur : une origine `https://` sans chemin ni identifiants (`http://` admis uniquement pour un hôte local) ; sinon erreur explicite.
- En production (`NODE_ENV=production`) une variable absente lève une erreur au premier appel : aucune adresse n'est devinée. Les appels étant faits à l'import des configs, un build sans variable échoue.
- Un `.env.example` par app liste les variables qu'elle utilise ; l'app `auth` liste les quatre, plus `NEXT_PUBLIC_AUTH_RETURN_TO_ALLOWED_HOSTS` (liste blanche de `return_to`, hôtes séparés par des virgules).
- `isExternalHref(href)` distingue une adresse absolue d'un chemin interne.

## Pièges

- `ShellData.counts` est un `Record<string, number>` : les clés sont celles de l'app.
- `workspace.role` est libre ; le libellé affiché vient de `accountMenu.roleLabels`.
- `bottomItems` et `navigation` : mêmes `id` pour les entrées de la barre mobile, sinon elles réapparaissent dans « Plus ».
- Les liens de `href` du schéma sont internes uniquement (`/chemin`).
- Un composant générique manquant va dans `packages/ui`, pas dans l'app.
