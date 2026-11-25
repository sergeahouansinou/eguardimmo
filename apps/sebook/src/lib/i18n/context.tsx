"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DICT, type I18nKey, type Lang } from "./dictionaries";

const STORAGE_KEY = "eg_lang";

type TFn = (key: I18nKey, params?: Record<string, string | number>) => string;

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TFn;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function isLang(value: unknown): value is Lang {
  return value === "en" || value === "fr";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Langue par défaut = français (marché principal). Valeur stable utilisée par le
  // SSR ET le premier rendu client pour rester identiques (la préférence stockée
  // n'est lue qu'après le montage, cf. effet ci-dessous).
  const [lang, setLangState] = useState<Lang>("fr");

  // Read the persisted language only after mount to avoid hydration mismatches.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isLang(stored)) {
        // Intentional: deferring the persisted-preference read to a post-mount
        // effect is what keeps SSR and the first client render in sync (both
        // start at the default). Reading localStorage in the initializer would
        // reintroduce a hydration mismatch - so this setState is required here.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLangState(stored);
      }
    } catch {
      // localStorage unavailable (private mode, SSR) - keep default.
    }
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore persistence errors.
    }
  }, []);

  const t = useCallback<TFn>(
    (key, params) => {
      const entry = DICT[key];
      let result: string = entry[lang];
      if (params) {
        for (const [name, value] of Object.entries(params)) {
          result = result.split(`{${name}}`).join(String(value));
        }
      }
      return result;
    },
    [lang],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ lang, setLang, t }),
    [lang, setLang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return ctx;
}

export function useT(): TFn {
  return useI18n().t;
}
