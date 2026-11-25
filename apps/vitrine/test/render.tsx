import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export function renderPage(ui: ReactElement) {
  const user = userEvent.setup();
  const view = render(
    <>
      <SiteHeader />
      <main>{ui}</main>
      <SiteFooter />
    </>,
  );
  return { ...view, user };
}
