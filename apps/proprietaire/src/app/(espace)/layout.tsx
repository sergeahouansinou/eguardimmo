import { Suspense } from "react";
import { EspaceShell } from "./EspaceShell";

export default function EspaceLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense>
      <EspaceShell>{children}</EspaceShell>
    </Suspense>
  );
}
