import CustomerOrder from "../../TPV/CustomerOrder";

export const metadata = {
  title: "Pedido - La Lianta",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CustomerOrderPage({ searchParams }) {
  const params = await searchParams;
  const tableNumber = params?.mesa || "";

  return <CustomerOrder tableNumber={tableNumber} />;
}
