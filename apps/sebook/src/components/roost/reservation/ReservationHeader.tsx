"use client";

import Image from "next/image";
import Link from "next/link";
import { ACCENT } from "@/lib/roost-data";
import { useT } from "@/lib/i18n/context";
import { UI } from "./styles";

export default function ReservationHeader({ backHref }: { backHref: string | null }) {
  const t = useT();
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 60,
        background: "rgba(255,255,255,.93)",
        backdropFilter: "blur(18px) saturate(170%)",
        WebkitBackdropFilter: "blur(18px) saturate(170%)",
        borderBottom: "1px solid #EFEBE6",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", gap: 14 }}>
        {backHref ? (
          <Link
            href={backHref}
            aria-label={t("rsv_back")}
            className="r-hover-soft"
            style={{ width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: "#231F1C", flex: "0 0 auto" }}
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </Link>
        ) : null}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
          <Image src="/images/logo.avif" alt="" width={30} height={30} style={{ width: 30, height: 30, objectFit: "cover", borderRadius: "50%" }} />
          <span style={{ fontFamily: UI, fontWeight: 800, fontSize: 22, letterSpacing: "-0.03em", color: ACCENT }}>eGuardImmo</span>
        </Link>
      </div>
    </header>
  );
}
