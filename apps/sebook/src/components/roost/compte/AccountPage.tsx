"use client";

import Link from "next/link";
import { ApiError } from "@eguardimmo/api";
import { useMe } from "@/features/session/queries";
import { useSession } from "@/features/session/SessionProvider";
import { currentPageUrl, verifyEmailHref } from "@/features/session/signIn";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/context";
import { FONTS } from "@/lib/roost-data";
import { describeFailure } from "@/marketplace/errors";
import Footer from "../Footer";
import Header from "../Header";
import { SkelBlock, SkelRegion } from "../Skeleton";
import { UI } from "../reservation/styles";
import BookingsList from "./BookingsList";
import PageNotice from "./PageNotice";

function Gate() {
  const { t } = useI18n();
  const { authUrl } = useSession();
  const { openAuth } = useAuth();
  const me = useMe();

  if (me.isPending) {
    return (
      <SkelRegion label={t("acc_sessionLoading")} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SkelBlock style={{ height: 150, borderRadius: 18 }} />
      </SkelRegion>
    );
  }
  if (me.isError) {
    if (me.error instanceof ApiError && me.error.status === 401) {
      return <PageNotice text={t("acc_loginText")} action={{ label: t("acc_login"), onClick: () => { openAuth("login"); } }} />;
    }
    return <PageNotice role="alert" title={t("acc_sessionErrorTitle")} text={describeFailure(me.error).message} action={{ label: t("rsv_retry"), onClick: () => void me.refetch() }} />;
  }
  if (!me.data.verified) {
    const verify = verifyEmailHref(authUrl, currentPageUrl());
    return (
      <PageNotice
        role="alert"
        title={t("rsv_verifyTitle")}
        text={t("rsv_verifyText")}
        {...(verify ? { action: { label: t("rsv_verifyLink"), href: verify } } : {})}
      />
    );
  }
  return <BookingsList />;
}

export default function AccountPage() {
  const { t } = useI18n();
  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: FONTS.body }}>
      <Header />
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 12, margin: "0 0 28px" }}>
          <h1 style={{ fontFamily: UI, fontWeight: 700, fontSize: "clamp(22px, 4vw, 32px)", letterSpacing: "-0.02em", color: "#231F1C", margin: 0 }}>{t("acc_title")}</h1>
          <Link href="/favorites" className="r-hover-underline" style={{ color: "#6E6A66", fontSize: 15, fontWeight: 600, textDecoration: "none", minHeight: 44, display: "inline-flex", alignItems: "center" }}>
            {t("acc_favoritesLink")}
          </Link>
        </div>
        <h2 style={{ fontFamily: UI, fontWeight: 700, fontSize: 21, letterSpacing: "-0.01em", color: "#231F1C", margin: "0 0 18px" }}>{t("acc_bookingsTitle")}</h2>
        <Gate />
      </main>
      <Footer />
    </div>
  );
}
