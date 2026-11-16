"use client";

import { ShellSourceProvider } from "@eguardimmo/shell";
import { useState } from "react";
import type { ReactNode } from "react";
import { createDemoSource } from "@/espace/demo";

export function DemoAgenceShell({ children }: { children: ReactNode }) {
  const [source] = useState(createDemoSource);
  return <ShellSourceProvider source={source}>{children}</ShellSourceProvider>;
}
