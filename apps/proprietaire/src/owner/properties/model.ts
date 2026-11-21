import type { Address, AgencyRef } from "../shared/model";

export interface OwnerUnit {
  id: string;
  reference: string;
  typeKey: string;
  floor: number | null;
  surfaceHundredths: number | null;
  propertyName: string;
  address: Address;
  agency: AgencyRef;
  mandantName: string | null;
  coveredFrom: string | null;
  coveredUntil: string | null;
}
