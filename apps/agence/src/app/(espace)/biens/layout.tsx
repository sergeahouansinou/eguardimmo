import { BiensRoot } from "@/features/gestion/BiensRoot";

export default function BiensLayout({ children }: LayoutProps<"/biens">) {
  return <BiensRoot>{children}</BiensRoot>;
}
