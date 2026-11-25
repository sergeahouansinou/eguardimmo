import { cache } from "react";
import { fetchListing } from "@/marketplace/server";

export const getListing = cache(fetchListing);
