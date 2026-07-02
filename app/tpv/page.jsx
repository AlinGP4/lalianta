import Link from "next/link";
import LogoutButton from "../../TPV/LogoutButton";

export const metadata = {
  title: "TPV - La Lianta",
  robots: {
    index: false,
    follow: false,
  },
};

export default function TpvHomePage() {
  return (
    <main className="tpv-page tpv-home">
      <section className="tpv-entry-panel">
        <div className="tpv-entry-head">
          <h1>TPV LaLianta</h1>
          <LogoutButton className="tpv-entry-logout" />
        </div>
        <nav className="tpv-entry-list" aria-label="Entrar al TPV">
          <Link className="tpv-entry" href="/tpv/admin/productos">
            <strong>TPV administración</strong>
          </Link>
          <Link className="tpv-entry" href="/tpv/pedidos">
            <strong>TPV Camarero</strong>
          </Link>
          <Link className="tpv-entry" href="/tpv/historico">
            <strong>TPV histórico</strong>
          </Link>
        </nav>
      </section>
    </main>
  );
}
