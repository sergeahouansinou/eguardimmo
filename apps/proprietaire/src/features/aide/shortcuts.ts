export interface Shortcut {
  id: string;
  keys: readonly (readonly string[])[];
  label: string;
}

export interface ShortcutGroup {
  id: string;
  title: string;
  shortcuts: readonly Shortcut[];
}

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  {
    id: "navigation",
    title: "Navigation",
    shortcuts: [
      { id: "recherche", keys: [["⌘", "K"], ["Ctrl", "K"]], label: "Ouvrir la recherche de pages" },
      { id: "raccourcis", keys: [["?"]], label: "Afficher les raccourcis clavier" },
      { id: "contenu", keys: [["Tab"]], label: "Aller au contenu, premier arrêt de la page" },
    ],
  },
  {
    id: "recherche",
    title: "Dans la recherche",
    shortcuts: [
      { id: "resultat", keys: [["↑"], ["↓"]], label: "Parcourir les résultats" },
      { id: "ouvrir", keys: [["Entrée"]], label: "Ouvrir la page sélectionnée" },
      { id: "fermer", keys: [["Échap"]], label: "Fermer la recherche" },
    ],
  },
  {
    id: "menus",
    title: "Menus, fenêtres et sélecteurs",
    shortcuts: [
      { id: "menu", keys: [["↑"], ["↓"]], label: "Parcourir les entrées d’un menu" },
      { id: "choix", keys: [["←"], ["→"]], label: "Changer de choix dans un sélecteur (période, format, mode)" },
      { id: "echap", keys: [["Échap"]], label: "Fermer un menu ou une fenêtre" },
      { id: "focus", keys: [["Tab"], ["Maj", "Tab"]], label: "Passer au champ suivant ou précédent" },
    ],
  },
];
