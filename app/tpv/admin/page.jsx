import AdminDashboard from "../../../TPV/AdminDashboard";

export const metadata = {
  title: "TPV Administracion - La Lianta",
  robots: {
    index: false,
    follow: false,
  },
};

export default function TpvAdminPage() {
  return <AdminDashboard />;
}
