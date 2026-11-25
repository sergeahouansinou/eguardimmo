import Footer from "@/components/roost/Footer";
import Header from "@/components/roost/Header";
import { NotFoundMessage } from "@/components/roost/SystemMessage";
import { FONTS } from "@/lib/roost-data";

export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: FONTS.body }}>
      <Header />
      <main>
        <NotFoundMessage />
      </main>
      <Footer />
    </div>
  );
}
