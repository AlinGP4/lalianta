import LoginPage from "../../../TPV/LoginPage";

export const metadata = {
  title: "Login TPV - La Lianta",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function TpvLoginPage({ searchParams }) {
  const params = await searchParams;
  return <LoginPage next={params?.next || ""} />;
}
