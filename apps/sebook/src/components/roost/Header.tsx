"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/features/session/SessionProvider";
import { hostSignUpHref } from "@/features/session/signIn";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/context";
import { FONTS } from "@/lib/roost-data";
import { EMPTY_SEARCH, searchHref } from "@/marketplace/search";
import { LanguageMenu } from "./header/LanguageMenu";
import { UserMenu } from "./header/UserMenu";
import { GlobeIcon } from "./icons";

const LONG_TERM_HREF = searchHref({ ...EMPTY_SEARCH, scope: "long_term" });

export default function Header() {
  const { t } = useI18n();
  const { authUrl } = useSession();
  const { user, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const anyOpen = menuOpen || langOpen;
  const hostHref = hostSignUpHref(authUrl);
  const homesActive = pathname === "/" || pathname.startsWith("/destinations") || pathname.startsWith("/listings");

  const closeAll = () => {
    setMenuOpen(false);
    setLangOpen(false);
  };

  useEffect(() => {
    if (!anyOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setLangOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [anyOpen]);

  const tabs = [
    { icon: "🏡", label: t("navHomes"), href: "/destinations", active: homesActive },
    { icon: "🗓️", label: t("sbNavLongTerm"), href: LONG_TERM_HREF, active: false },
  ];

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 80,
        background: "linear-gradient(180deg, rgba(255,255,255,.96) 0%, rgba(237,243,250,.80) 55%, rgba(255,255,255,.72) 100%)",
        backdropFilter: "blur(22px) saturate(180%)",
        WebkitBackdropFilter: "blur(22px) saturate(180%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(255,255,255,.45), 0 6px 22px rgba(40,60,90,.08)",
        borderBottom: "1px solid rgba(214,226,238,.55)",
      }}
    >
      <div className="r-header-inner" style={{ maxWidth: 1320, margin: "0 auto", padding: "24px 40px 10px", display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", minWidth: 0 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
            <Image src="/images/logo.avif" alt="eGuardImmo" width={36} height={36} loading="eager" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: "50%" }} />
            <span style={{ fontFamily: FONTS.ui, fontWeight: 800, fontSize: 23, letterSpacing: "-0.03em", color: "#85C920" }}>
              Se <span style={{ color: "#231F1C" }}>Book</span>
            </span>
          </Link>
        </div>

        <nav className="r-nav-tabs" aria-label={t("sbNavLabel")} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 4 }}>
          {tabs.map((tab) => (
            <Link
              key={tab.label}
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={tab.active ? undefined : "r-hover-dark"}
              style={{ display: "flex", alignItems: "center", gap: 7, textDecoration: "none", color: tab.active ? "#231F1C" : "#6E6A66", fontWeight: tab.active ? 600 : 500, fontSize: 15, padding: "6px 10px 14px", borderBottom: `2px solid ${tab.active ? "#231F1C" : "transparent"}` }}
            >
              <span aria-hidden="true" style={{ fontSize: 18 }}>{tab.icon}</span>
              {tab.label}
            </Link>
          ))}
        </nav>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, position: "relative" }}>
          {hostHref && (
            <a href={hostHref} className="r-hover-soft r-become-host" style={{ fontSize: 14, fontWeight: 600, padding: "12px 14px", borderRadius: 30, color: "#231F1C", textDecoration: "none", whiteSpace: "nowrap" }}>
              {t("becomeHost")}
            </a>
          )}
          <button
            type="button"
            aria-label={t("languageAria")}
            aria-expanded={langOpen}
            className="r-hover-soft"
            onClick={() => {
              setLangOpen((open) => !open);
              setMenuOpen(false);
            }}
            style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#231F1C" }}
          >
            <GlobeIcon />
          </button>
          <button
            type="button"
            className="r-hover-shadow"
            aria-label={t("userMenuAria")}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => {
              setMenuOpen((open) => !open);
              setLangOpen(false);
            }}
            style={{ display: "flex", alignItems: "center", gap: 9, border: "1px solid #E2DDD6", borderRadius: 30, padding: "5px 6px 5px 13px", background: "#fff", cursor: "pointer" }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#231F1C" strokeWidth={1.9} strokeLinecap="round" aria-hidden="true">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
            <span style={{ width: 30, height: 30, borderRadius: "50%", background: isAuthenticated ? "#85C920" : "#6E6A66", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: FONTS.ui, flexShrink: 0 }}>
              {user ? (user.name.trim()[0] ?? "U").toUpperCase() : (
                <svg width={16} height={16} viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                  <path d="M12 12a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Zm0 1.8c-3.6 0-8 1.9-8 5.2V21h16v-2c0-3.3-4.4-5.2-8-5.2Z" />
                </svg>
              )}
            </span>
          </button>

          {anyOpen && <div aria-hidden="true" onClick={closeAll} style={{ position: "fixed", inset: 0, zIndex: 60 }} />}
          {langOpen && <LanguageMenu />}
          {menuOpen && <UserMenu onClose={closeAll} />}
        </div>
      </div>
    </header>
  );
}
