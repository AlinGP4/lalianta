import AdminShell from "./AdminShell";
import ProductCrud from "./ProductCrud";

export default function ProductAdminPage() {
  return (
    <AdminShell active="productos">
      <header className="tpv-admin-head">
        <div>
          <p className="tpv-kicker">TPV Administracion</p>
          <h1>Productos</h1>
        </div>
        <div className="tpv-head-actions">
          <a className="tpv-button tpv-button-secondary" href="/tpv/admin">Volver al panel</a>
        </div>
      </header>

      <ProductCrud />
    </AdminShell>
  );
}
