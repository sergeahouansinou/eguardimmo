import { Badge } from "@eguardimmo/ui";
import Link from "next/link";
import { confieRoutes } from "@/features/confie/routes";
import { DataTable } from "@/features/confie/ui/DataTable";
import type { Column } from "@/features/confie/ui/DataTable";
import { EmptyLine } from "@/features/confie/ui/States";
import { Caption, Section } from "@/features/confie/ui/Section";
import { NOT_AVAILABLE, formatMoney, formatMonth, formatSurface, unitTypeLabel } from "../format";
import { SectionLink, plural } from "./HomeStats";
import { UNIT_STATE } from "./labels";
import type { HomeUnit, OwnerHome } from "./model";

function columnsFor(month: string): readonly Column<HomeUnit>[] {
  return [
    {
      id: "lot",
      header: "Lot",
      primary: true,
      cell: (unit) => (
        <>
          <Link href={confieRoutes.bien(unit.id)} className="underline-offset-3 hover:underline">
            {unit.label}
          </Link>
          <br />
          <Caption>{`${unitTypeLabel(unit.type)}, ${formatSurface(unit.surfaceHundredths)}`}</Caption>
        </>
      ),
    },
    { id: "tenant", header: "Locataire", cell: (unit) => unit.tenantName ?? (unit.state === "vacant" ? "Aucun locataire" : NOT_AVAILABLE) },
    { id: "rent", header: "Loyer du mois", align: "end", cell: (unit) => (unit.rent === null ? NOT_AVAILABLE : formatMoney(unit.rent)) },
    { id: "collected", header: `Encaissé en ${month}`, align: "end", cell: (unit) => <span className={unit.state === "late" ? "font-semibold text-fg-danger" : undefined}>{formatMoney(unit.collected)}</span> },
    { id: "state", header: "État", cell: (unit) => <Badge tone={UNIT_STATE[unit.state].tone}>{UNIT_STATE[unit.state].label}</Badge> },
  ];
}

export function UnitsSection({ home }: { home: OwnerHome }) {
  const month = formatMonth(home.month.period).toLowerCase();
  const { unitsTotal, unitsOccupied, unitsVacant } = home.counters;
  return (
    <Section title="Mes biens" aside={<SectionLink href={confieRoutes.biens}>Tous mes biens</SectionLink>}>
      {home.units.length === 0 ? (
        <EmptyLine>Aucun lot n’est couvert par un mandat en cours.</EmptyLine>
      ) : (
        <>
          <Caption>{`${plural(unitsTotal, "lot")} : ${plural(unitsOccupied, "occupé")}, ${plural(unitsVacant, "vacant")}`}</Caption>
          <DataTable caption="Mes biens" columns={columnsFor(month)} rows={home.units.map((unit) => ({ key: unit.id, value: unit }))} />
        </>
      )}
    </Section>
  );
}
