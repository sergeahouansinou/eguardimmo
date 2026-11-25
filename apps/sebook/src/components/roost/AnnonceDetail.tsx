"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import BookingCard from "./BookingCard";
import { Amenities } from "./annonce/Amenities";
import { AvailabilitySection } from "./annonce/AvailabilitySection";
import { Breadcrumb } from "./annonce/Breadcrumb";
import { Characteristics } from "./annonce/Characteristics";
import { Description } from "./annonce/Description";
import { Gallery } from "./annonce/Gallery";
import { Overview } from "./annonce/Overview";
import { ThingsToKnow } from "./annonce/ThingsToKnow";
import { TitleRow } from "./annonce/TitleRow";
import { useStay } from "./annonce/useStay";
import type { StayInitial } from "./annonce/useStay";
import { useI18n } from "@/lib/i18n/context";
import { toAnnonceView } from "@/marketplace/roostDetail";
import type { ListingDetail } from "@/marketplace/schemas";

const ContactHostModal = dynamic(() => import("./ContactHostModal"));

export default function AnnonceDetail({ detail, initial }: { detail: ListingDetail; initial: StayInitial }) {
  const { lang } = useI18n();
  const view = useMemo(() => toAnnonceView(detail, lang === "fr" ? "fr-FR" : "en-US"), [detail, lang]);
  const stay = useStay(view, initial);
  const [visitOpen, setVisitOpen] = useState(false);
  const isStay = view.kind === "short_stay";

  return (
    <>
      <main className="r-annonce-main" style={{ maxWidth: 1280, margin: "0 auto", padding: "30px 40px 0" }}>
        <TitleRow reference={view.ref} title={view.title} />
        <Gallery scenes={view.gallery} />
        <div className="r-annonce-cols" style={{ display: "flex", gap: 64, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 auto", minWidth: 0, maxWidth: 680 }}>
            <Overview view={view} />
            <Description paragraphs={view.paragraphs} />
            <Characteristics items={view.characteristics} />
            <Amenities amenities={view.amenities} />
            {isStay ? <AvailabilitySection stay={stay} where={view.cityName ?? view.title} /> : null}
          </div>
          <div className="r-annonce-sticky" style={{ position: "sticky", top: 96 }}>
            <BookingCard
              view={view}
              stay={stay}
              onRequestVisit={() => {
                setVisitOpen(true);
              }}
            />
          </div>
        </div>
        {isStay ? <ThingsToKnow policy={view.policy} /> : <div style={{ height: 64 }} />}
      </main>
      <Breadcrumb kind={view.kind} cityName={view.cityName} />
      {visitOpen ? (
        <ContactHostModal
          reference={view.ref}
          hostName={view.hostName}
          onClose={() => {
            setVisitOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
