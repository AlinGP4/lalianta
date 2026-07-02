import Link from "next/link";
import ProductCrud from "./ProductCrud";

export default function ProductAdminPage() {
  return (
    <>
      <header className="tpv-admin-head">
        <div>
          <p className="tpv-kicker">TPV Administración</p>
          <h1>Productos</h1>
        </div>
        <div className="tpv-head-actions">
          <Link className="tpv-button tpv-button-secondary" href="/tpv">Inicio TPV</Link>
        </div>
      </header>

      <ProductCrud />
    </>
  );
}
