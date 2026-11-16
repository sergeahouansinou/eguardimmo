"use client";

import { GestionSourceProvider, createDemoSource } from "@eguardimmo/gestion";
import { useState } from "react";
import type { ReactNode } from "react";

export function DemoGestionSource({ children }: { children: ReactNode }) {
  const [source] = useState(createDemoSource);
  return <GestionSourceProvider source={source}>{children}</GestionSourceProvider>;
}
