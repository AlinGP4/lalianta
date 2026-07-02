import { redirect } from "next/navigation";

export const metadata = {
  title: "TPV Administración - La Lianta",
  robots: {
    index: false,
    follow: false,
  },
};

export default function TpvAdminPage() {
  redirect("/tpv/admin/productos");
}
