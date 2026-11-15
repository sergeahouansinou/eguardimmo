import { BiensRoot } from "./BiensRoot";

export default function BiensLayout({ children }: LayoutProps<"/biens">) {
  return <BiensRoot>{children}</BiensRoot>;
}
