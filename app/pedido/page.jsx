import CustomerOrder from "../../TPV/CustomerOrder";

export const metadata = {
  title: "Pedido - La Lianta",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CustomerOrderPage() {
  return <CustomerOrder />;
}
