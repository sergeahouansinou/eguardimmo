import { connection } from "next/server";
import RoostHome from "@/components/roost/RoostHome";
import { buildHomeJsonLd } from "@/lib/seo";
import { JsonLdScript } from "@/marketplace/JsonLdScript";
import { toListing } from "@/marketplace/roost";
import { getHomeListings } from "./getHomeListings";

export async function HomeView() {
  await connection();
  const home = await getHomeListings();
  return (
    <>
      {buildHomeJsonLd().map((node, index) => (
        <JsonLdScript key={index} data={node} />
      ))}
      {home.status === "ready" ? <RoostHome short={home.short.map(toListing)} long={home.long.map(toListing)} status="ready" /> : <RoostHome short={[]} long={[]} status="unavailable" />}
    </>
  );
}
