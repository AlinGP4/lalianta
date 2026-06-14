export default function AdminShell({ active = "panel", children }) {
  return (
    <main className="tpv-shell tpv-admin">
      <aside className="tpv-sidebar" aria-label="TPV administracion">
        <a className="tpv-brand" href="/">
          <span className="tpv-brand-mark">L</span>
          <span>La Lianta</span>
        </a>
        <nav className="tpv-nav" aria-label="Secciones">
          <a className={active === "panel" ? "is-active" : ""} href="/tpv/admin">Panel</a>
          <a className={active === "productos" ? "is-active" : ""} href="/tpv/admin/productos">Productos</a>
          <a className={active === "mesas" ? "is-active" : ""} href="/tpv/admin/mesas">Mesas</a>
          <a className={active === "caja" ? "is-active" : ""} href="/tpv/admin/caja">Caja</a>
          <a className={active === "usuarios" ? "is-active" : ""} href="/tpv/admin/usuarios">Usuarios</a>
        </nav>
      </aside>

      <section className="tpv-admin-main">{children}</section>
    </main>
  );
}
