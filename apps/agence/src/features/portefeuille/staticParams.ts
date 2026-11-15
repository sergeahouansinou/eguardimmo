import { createDemoData } from "./demo";

type IdParams = { id: string }[];

const ids = (pick: (data: ReturnType<typeof createDemoData>) => { id: string }[]): IdParams => pick(createDemoData()).map(({ id }) => ({ id }));

export const mandantIds = (): IdParams => ids((data) => data.mandants);
export const mandatIds = (): IdParams => ids((data) => data.mandats);
export const bienIds = (): IdParams => ids((data) => data.biens);
export const locataireIds = (): IdParams => ids((data) => data.locataires);
export const bailIds = (): IdParams => ids((data) => data.baux);
