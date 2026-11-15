// Fichier généré par scripts/build.mjs : ne pas modifier à la main.
export const tokens = {
  color: {
    light: {
      bg: {
        page: "#F6F8F8",
        surface: "#FFFFFF",
        muted: "#EEF2F2",
        disabled: "#F6F8F8",
      },
      border: {
        default: "#DDE4E5",
        control: "#5F7176",
        strong: "#334349",
      },
      text: {
        default: "#14202A",
        muted: "#334349",
        subtle: "#5F7176",
        placeholder: "#5F7176",
        disabled: "#9AAAAE",
        inverse: "#FFFFFF",
        danger: "#B42318",
      },
      action: {
        default: "#1A6F84",
        hover: "#145A6B",
        pressed: "#0F4753",
        subtle: "#F1F9FB",
        onSubtle: "#145A6B",
        text: "#FFFFFF",
      },
      accent: {
        default: "#C6EC4F",
        on: "#0B2E38",
      },
      focus: {
        ring: "#1A6F84",
      },
      nav: {
        bg: "#0B2E38",
        text: "#DDE4E5",
        muted: "#9AAAAE",
        active: "#C6EC4F",
        activeBg: "#C6EC4F24",
      },
      info: {
        bg: "#F1F9FB",
        border: "#7FB8C7",
        text: "#145A6B",
      },
      success: {
        bg: "#ECFDF3",
        border: "#17B26A",
        text: "#067647",
      },
      warning: {
        bg: "#FFFAEB",
        border: "#F79009",
        text: "#93370D",
      },
      danger: {
        bg: "#FEF3F2",
        border: "#F97066",
        text: "#B42318",
        default: "#B42318",
        hover: "#912018",
      },
      tooltip: {
        bg: "#14202A",
        text: "#F6F8F8",
      },
      chart: {
        called: "#9AAAAE",
        collected: "#1F7F96",
        due: "#B42318",
        grid: "#DDE4E5",
        highlight: "#0B2E380D",
      },
    },
    dark: {
      bg: {
        page: "#181818",
        surface: "#1F1F1F",
        muted: "#2A2A2A",
        disabled: "#2A2A2A",
      },
      border: {
        default: "#3A3A3A",
        control: "#9AAAAE",
        strong: "#C4CFD1",
      },
      text: {
        default: "#F6F8F8",
        muted: "#C4CFD1",
        subtle: "#9AAAAE",
        placeholder: "#9AAAAE",
        disabled: "#5F7176",
        inverse: "#FFFFFF",
        danger: "#F97066",
      },
      action: {
        default: "#1A6F84",
        hover: "#1F7F96",
        pressed: "#145A6B",
        subtle: "#2A8FA829",
        onSubtle: "#A9D5DF",
        text: "#FFFFFF",
      },
      accent: {
        default: "#C6EC4F",
        on: "#0B2E38",
      },
      focus: {
        ring: "#2A8FA8",
      },
      nav: {
        bg: "#0B2E38",
        text: "#DDE4E5",
        muted: "#9AAAAE",
        active: "#C6EC4F",
        activeBg: "#C6EC4F24",
      },
      info: {
        bg: "#2A8FA829",
        border: "#2A8FA8",
        text: "#A9D5DF",
      },
      success: {
        bg: "#17B26A29",
        border: "#17B26A",
        text: "#ECFDF3",
      },
      warning: {
        bg: "#F7900929",
        border: "#F79009",
        text: "#FFFAEB",
      },
      danger: {
        bg: "#F9706629",
        border: "#F97066",
        text: "#FEF3F2",
        default: "#B42318",
        hover: "#912018",
      },
      tooltip: {
        bg: "#14202A",
        text: "#F6F8F8",
      },
      chart: {
        called: "#5F7176",
        collected: "#2A8FA8",
        due: "#F97066",
        grid: "#334349",
        highlight: "#FFFFFF0F",
      },
    },
  },
  font: {
    family: {
      sans: "Inter, system-ui, sans-serif",
    },
  },
  text: {
    pageTitle: {
      fontSize: 20,
      lineHeight: 28,
      fontWeight: 600,
    },
    emptyTitle: {
      fontSize: 24,
      lineHeight: 32,
      fontWeight: 600,
    },
    blockTitle: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: 600,
    },
    value: {
      fontSize: 18,
      lineHeight: 28,
      fontWeight: 600,
    },
    body: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: 400,
    },
    bodyStrong: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: 500,
    },
    caption: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: 500,
    },
  },
  space: {
    0: 0,
    2: 2,
    4: 4,
    6: 6,
    8: 8,
    10: 10,
    12: 12,
    16: 16,
    20: 20,
    24: 24,
    32: 32,
    40: 40,
  },
  radius: {
    xs: 4,
    sm: 6,
    md: 8,
    lg: 12,
    full: 999,
  },
  control: {
    height: {
      xs: 24,
      sm: 28,
      md: 32,
      row: 36,
      lg: 40,
    },
  },
  border: {
    width: 1,
  },
  focus: {
    width: 2,
    offset: 2,
  },
  icon: {
    size: {
      sm: 14,
      md: 16,
      lg: 20,
    },
    stroke: 1.75,
  },
  duration: {
    fast: 120,
    normal: 200,
  },
  breakpoint: {
    sm: 600,
    md: 900,
    lg: 1280,
    xl: 1440,
  },
} as const;

export type Tokens = typeof tokens;
export type Theme = keyof Tokens['color'];
export type ThemeColors = Tokens['color'][Theme];
