import type { ApiClient } from "@eguardimmo/api";
import type { z } from "zod";
import { toAddress } from "../shared/mapping";
import type { CursorPage } from "../shared/model";
import { listQuery, parse, segment } from "../shared/parse";
import type { OwnerUnit } from "./model";
import { unitDetailSchema, unitPageSchema, unitSchema } from "./schemas";

export const PROPERTIES_PATH = "/api/v1/owner/properties";

function toUnit(unit: z.infer<typeof unitSchema>): OwnerUnit {
  return {
    id: unit.id,
    reference: unit.reference,
    typeKey: unit.type,
    floor: unit.floor,
    surfaceHundredths: unit.surface_hundredths,
    propertyName: unit.property.name,
    address: toAddress(unit.property.address),
    agency: unit.agency,
    mandantName: unit.mandant.name,
    coveredFrom: unit.covered_from,
    coveredUntil: unit.covered_until,
  };
}

export async function fetchPropertiesPage(client: ApiClient, agency: string | null, cursor: string | null): Promise<CursorPage<OwnerUnit>> {
  const page = parse(unitPageSchema, await client.get(PROPERTIES_PATH, listQuery(agency, cursor)));
  return { items: page.data.map(toUnit), nextCursor: page.meta.next_cursor };
}

export async function fetchProperty(client: ApiClient, id: string): Promise<OwnerUnit> {
  return toUnit(parse(unitDetailSchema, await client.get(`${PROPERTIES_PATH}/${segment(id)}`)).data);
}
