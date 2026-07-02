import { redirect } from "next/navigation";
import SetupPage from "../../../TPV/SetupPage";
import { countUsers } from "../../../Backend/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Setup TPV - La Lianta",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function TpvSetupPage() {
  if ((await countUsers()) > 0) {
    redirect("/tpv/login");
  }

  return <SetupPage />;
}
