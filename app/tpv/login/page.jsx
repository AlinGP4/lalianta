import LoginPage from "../../../TPV/LoginPage";
import { countUsers } from "../../../Backend/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Login TPV - La Lianta",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function TpvLoginPage({ searchParams }) {
  const params = await searchParams;
  const setupAvailable = (await countUsers()) === 0;
  return <LoginPage next={params?.next || ""} setupAvailable={setupAvailable} />;
}
