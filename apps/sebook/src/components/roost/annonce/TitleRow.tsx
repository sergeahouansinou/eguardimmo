"use client";

import { useEffect, useRef, useState } from "react";
import { ACCENT, FONTS } from "@/lib/roost-data";
import { useRequireAuth } from "@/lib/auth/use-require-auth";
import { useFavorites } from "@/lib/favorites";
import { useT } from "@/lib/i18n/context";
import { INK, underlineBtn } from "./ui";

const COPIED_MS = 2000;

export function TitleRow({ reference, title }: { reference: string; title: string }) {
  const t = useT();
  const { isFavorite, toggle } = useFavorites();
  const requireAuth = useRequireAuth();
  const saved = isFavorite(reference);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );

  const share = async () => {
    const url = `${window.location.origin}/listings/${reference}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setCopied(false);
      }, COPIED_MS);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px 24px", flexWrap: "wrap", marginBottom: 18 }}>
      <h1
        style={{
          fontFamily: FONTS.ui,
          fontWeight: 700,
          fontSize: 27,
          lineHeight: 1.2,
          letterSpacing: "-0.02em",
          color: INK,
          margin: 0,
          maxWidth: 760,
          overflowWrap: "anywhere",
        }}
      >
        {title}
      </h1>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "0 0 auto" }}>
        <button
          type="button"
          onClick={() => {
            void share();
          }}
          className="r-hover-soft"
          style={underlineBtn}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
            <path d="M16 6l-4-4-4 4" />
            <path d="M12 2v13" />
          </svg>
          {copied ? t("linkCopied") : t("share")}
        </button>
        <span role="status" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          {copied ? t("linkCopied") : ""}
        </span>
        <button
          type="button"
          onClick={() => {
            requireAuth(() => {
              void toggle(reference);
            });
          }}
          aria-pressed={saved}
          aria-label={saved ? t("removeFromFavorites") : t("addToFavorites")}
          className="r-hover-soft"
          style={underlineBtn}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill={saved ? ACCENT : "none"} stroke={saved ? ACCENT : INK} strokeWidth={1.9} aria-hidden="true">
            <path d="M12 21s-7-4.6-9.5-9C1 9 2.2 5 6 5c2.2 0 3.4 1.4 4 2.5C10.6 6.4 11.8 5 14 5c3.8 0 5 4 3.5 7-2.5 4.4-9.5 9-9.5 9z" />
          </svg>
          {saved ? t("saved") : t("save")}
        </button>
      </div>
    </div>
  );
}
