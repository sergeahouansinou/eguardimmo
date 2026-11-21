"use client";

import { FailureNotice, Loading } from "../screens/FailureNotice";
import { LastReportSection, MandateSection, NextPayoutSection } from "./HomeSections";
import { HomeStats, QuotesAlert } from "./HomeStats";
import { UnitsSection } from "./HomeUnits";
import { useOwnerHome } from "./queries";

export function HomeData({ agency }: { agency: string }) {
  const query = useOwnerHome(agency);
  if (query.data === undefined) {
    return query.isError ? (
      <FailureNotice title="Votre synthèse n’a pas pu être chargée" error={query.error} onRetry={() => void query.refetch()} />
    ) : (
      <Loading label="Chargement de votre synthèse" rows={4} />
    );
  }
  const home = query.data;
  return (
    <>
      <QuotesAlert count={home.counters.quotesToDecide} />
      <HomeStats home={home} />
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        <MandateSection home={home} />
        {home.payouts === null ? null : <NextPayoutSection payouts={home.payouts} />}
        <LastReportSection report={home.lastReport} />
      </div>
      <UnitsSection home={home} />
    </>
  );
}
