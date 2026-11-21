export interface Money {
  amount: number;
  currency: string;
}

export interface AgencyRef {
  id: string;
  name: string | null;
}

export interface Address {
  line1: string;
  line2: string | null;
  postalCode: string;
  city: string;
  country: string;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}
