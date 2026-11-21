"use client";

import { useRouter } from "next/navigation";
import { confieRoutes } from "@/features/confie/routes";
import { PageHeader } from "@/features/confie/ui/PageHeader";
import { useOwnerSelection } from "../selection";
import { AgencyFilter } from "../shared/AgencyFilter";
import { useAgencyFilter } from "../shared/useAgencyFilter";
import { formatMonth } from "../format";
import { MonthSelect } from "./MonthSelect";
import { PayoutsSections } from "./PayoutsSections";
import { RentMonthSections } from "./RentMonthSections";
import { currentMonth } from "./months";

function useMonthNavigation(agency: string | null) {
  const router = useRouter();
  return (month: string) => {
    router.push(`${confieRoutes.reversement(month)}${agency === null ? "" : `?agency=${encodeURIComponent(agency)}`}`);
  };
}

export function LoyersScreen() {
  const filter = useAgencyFilter();
  const { accesses } = useOwnerSelection();
  const goTo = useMonthNavigation(filter.agency);
  const month = currentMonth();
  const scope = accesses.filter((access) => filter.agency === null || access.agencyId === filter.agency);
  return (
    <>
      <PageHeader title="Loyers et reversements" subtitle={`Loyers de ${formatMonth(month).toLowerCase()} et versements de votre agence`} />
      <AgencyFilter filter={filter} />
      <MonthSelect value={month} onChange={goTo} />
      {filter.unknown ? null : (
        <>
          <RentMonthSections month={month} agency={filter.agency} enabled />
          <PayoutsSections agency={filter.agency} enabled coOwnerOnly={scope.length > 0 && scope.every((access) => access.role === "co_owner")} />
        </>
      )}
    </>
  );
}

export function RentMonthScreen({ month }: { month: string }) {
  const filter = useAgencyFilter();
  const goTo = useMonthNavigation(filter.agency);
  return (
    <>
      <PageHeader
        title={`Loyers de ${formatMonth(month).toLowerCase()}`}
        subtitle="Par agence et par mandat"
        crumbs={[{ label: "Loyers et reversements", href: confieRoutes.loyers }, { label: formatMonth(month) }]}
      />
      <AgencyFilter filter={filter} />
      <MonthSelect value={month} onChange={goTo} />
      {filter.unknown ? null : <RentMonthSections month={month} agency={filter.agency} enabled />}
    </>
  );
}
