import { NotFoundState } from "@/features/confie/ui/States";
import { confieRoutes } from "@/features/confie/routes";

export default function NotFound() {
  return <NotFoundState title="Page introuvable" backHref={confieRoutes.home} backLabel="Revenir à l'accueil" />;
}
