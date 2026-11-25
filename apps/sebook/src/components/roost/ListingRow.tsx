"use client";

import Link from "next/link";
import { useRef } from "react";
import { useI18n } from "@/lib/i18n/context";
import type { Listing } from "@/lib/roost-data";
import ListingCard from "./ListingCard";

function Arrow({ d, label, onClick }: { d: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="r-hover-border"
      onClick={onClick}
      style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #DDD8D1", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#231F1C" }}
    >
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={d} />
      </svg>
    </button>
  );
}

export default function ListingRow({ title, items, href }: { title: string; items: Listing[]; href: string }) {
  const { t } = useI18n();
  const scroller = useRef<HTMLDivElement>(null);

  const scrollBy = (dx: number) => {
    const el = scroller.current;
    if (!el) return;
    const start = el.scrollLeft;
    const target = Math.max(0, Math.min(start + dx, el.scrollWidth - el.clientWidth));
    const duration = 420;
    let origin: number | null = null;
    const step = (now: number) => {
      origin ??= now;
      const progress = Math.min(1, (now - origin) / duration);
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      el.scrollLeft = start + (target - start) * eased;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  return (
    <section aria-label={title} style={{ marginBottom: 36 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 14 }}>
        <Link href={href} className="r-hover-fade" style={{ display: "flex", alignItems: "center", gap: 11, color: "#231F1C", textDecoration: "none" }}>
          <h2 style={{ margin: 0, fontSize: "clamp(18px, 3.4vw, 24px)", fontWeight: 700, letterSpacing: "-0.02em" }}>{title}</h2>
          <span style={{ width: 30, height: 30, borderRadius: "50%", background: "#F1ECE6", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#231F1C" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </Link>
        <div style={{ display: "flex", gap: 10, flex: "0 0 auto" }}>
          <Arrow d="M15 6l-6 6 6 6" label={t("sbScrollBack")} onClick={() => { scrollBy(-900); }} />
          <Arrow d="M9 6l6 6-6 6" label={t("sbScrollForward")} onClick={() => { scrollBy(900); }} />
        </div>
      </div>
      <div ref={scroller} className="cat-scroll" style={{ display: "flex", gap: 16, overflowX: "auto", scrollSnapType: "x proximity", paddingBottom: 4 }}>
        {items.map((item) => (
          <ListingCard key={item.id} listing={item} carousel />
        ))}
      </div>
    </section>
  );
}
