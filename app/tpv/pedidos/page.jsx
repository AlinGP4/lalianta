import OrdersMobile from "../../../TPV/OrdersMobile";

export const metadata = {
  title: "TPV Pedidos - La Lianta",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function TpvOrdersPage({ searchParams }) {
  const params = await searchParams;
  const tableNumber = params?.mesa || "";

  return <OrdersMobile initialTableNumber={tableNumber} />;
}
