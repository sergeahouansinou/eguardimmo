"use client";

import { useSession } from "@/features/session/SessionProvider";
import { hostSignUpHref } from "@/features/session/signIn";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/context";
import { MenuButton, MenuDivider, MenuLink } from "./MenuItem";

export function UserMenu({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { authUrl } = useSession();
  const { user, isAuthenticated, openAuth, logout } = useAuth();
  const hostHref = hostSignUpHref(authUrl);

  return (
    <div role="menu" style={{ position: "absolute", top: 56, right: 0, zIndex: 70, background: "#fff", border: "1px solid #EBE7E2", borderRadius: 16, boxShadow: "0 12px 32px rgba(0,0,0,.18)", padding: "9px 0", width: 240, overflow: "hidden" }}>
      {isAuthenticated ? (
        <>
          {user && <div style={{ padding: "10px 18px 8px", fontSize: 13, color: "#6E6A66" }}>{user.name}</div>}
          <MenuDivider margin="4px 0 8px" />
          <MenuLink href="/compte" onClick={onClose}>{t("acc_bookingsTitle")}</MenuLink>
          <MenuLink href="/favorites" onClick={onClose}>{t("acc_favoritesLink")}</MenuLink>
          <MenuLink href="/aide" onClick={onClose}>{t("helpCentre")}</MenuLink>
          <MenuDivider />
          <MenuButton
            weight={600}
            color="#B3321F"
            onClick={() => {
              onClose();
              void logout();
            }}
          >
            {t("logoutWord")}
          </MenuButton>
        </>
      ) : (
        <>
          <MenuButton weight={700} onClick={() => { onClose(); openAuth("register"); }}>{t("signUp")}</MenuButton>
          <MenuButton onClick={() => { onClose(); openAuth("login"); }}>{t("logIn")}</MenuButton>
          <MenuDivider />
          {hostHref && <MenuLink external href={hostHref} onClick={onClose}>{t("becomeHost")}</MenuLink>}
          <MenuLink href="/aide" onClick={onClose}>{t("helpCentre")}</MenuLink>
        </>
      )}
    </div>
  );
}
