import type { Metadata } from "next";
import { Suspense } from "react";
import { HomeView } from "@/features/home/HomeView";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo";
import Loading from "./loading";

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME}, logements à réserver` },
  description: SITE_TAGLINE,
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <Suspense fallback={<Loading />}>
      <HomeView />
    </Suspense>
  );
}
