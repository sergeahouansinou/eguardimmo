import { todayOf } from "@/features/portefeuille/api/today";
import { DEMO_TODAY } from "@/lib/dates";
import { dataSource } from "@/lib/env";

export const todayIso = (): string => (dataSource === "demo" ? DEMO_TODAY : todayOf(new Date()));
