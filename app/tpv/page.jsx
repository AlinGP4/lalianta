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
        <h1>TPV LaLianta</h1>
        <nav className="tpv-entry-list" aria-label="Entrar al TPV">
          <a className="tpv-entry" href="/tpv/admin">
            <strong>TPV administracion</strong>
          </a>
          <a className="tpv-entry" href="/tpv/pedidos">
            <strong>TPV pedidos</strong>
          </a>
        </nav>
      </section>
    </main>
  );
}
