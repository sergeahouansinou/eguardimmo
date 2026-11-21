import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { dataSource } from "@/lib/env";

export function ApiOnly({ children }: { children: ReactNode }) {
  if (dataSource !== "api") notFound();
  return children;
}
