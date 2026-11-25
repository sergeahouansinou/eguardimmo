"use client";

import { useMemo, useState } from "react";
import { type HomeCategoryId, HOME_CATEGORIES, FONTS, type Listing, matchesHomeCategory } from "@/lib/roost-data";
import AppCta from "./AppCta";
import CategoryBar from "./CategoryBar";
import Footer from "./Footer";
import Header from "./Header";
import Hero from "./Hero";
import Listings, { type HomeStatus } from "./Listings";
import SearchBar from "./SearchBar";

export default function RoostHome({ short, long, status }: { short: Listing[]; long: Listing[]; status: HomeStatus }) {
  const [category, setCategory] = useState<HomeCategoryId>("all");

  const available = useMemo<HomeCategoryId[]>(() => {
    const pool = [...short, ...long];
    return HOME_CATEGORIES.map((entry) => entry.id).filter((id) => id === "all" || pool.some((item) => matchesHomeCategory(item, id)));
  }, [short, long]);

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: FONTS.body }}>
      <Header />
      <Hero />
      <SearchBar />
      <CategoryBar active={category} onChange={setCategory} available={available} />
      <Listings short={short} long={long} category={category} status={status} />
      <AppCta />
      <Footer />
    </div>
  );
}
