"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function getActiveSection(pathname) {
  if (pathname.includes("/tpv/admin/productos")) return "productos";
  if (pathname.includes("/tpv/admin/mesas")) return "mesas";
  if (pathname.includes("/tpv/admin/caja")) return "caja";
  if (pathname.includes("/tpv/admin/usuarios")) return "usuarios";
  return "panel";
}

export default function AdminShell({ active, children }) {
  const pathname = usePathname();
  const activeSection = active ?? getActiveSection(pathname);

  return (
    <main className="tpv-shell tpv-admin">
      <aside className="tpv-sidebar" aria-label="TPV administracion">
        <Link className="tpv-brand" href="/">
          <span className="tpv-brand-mark">L</span>
          <span>La Lianta</span>
        </Link>
        <nav className="tpv-nav" aria-label="Secciones">
          <Link className={activeSection === "panel" ? "is-active" : ""} href="/tpv/admin">Panel</Link>
          <Link className={activeSection === "productos" ? "is-active" : ""} href="/tpv/admin/productos">Productos</Link>
          <Link className={activeSection === "mesas" ? "is-active" : ""} href="/tpv/admin/mesas">Mesas</Link>
          <Link className={activeSection === "caja" ? "is-active" : ""} href="/tpv/admin/caja">Caja</Link>
          <Link className={activeSection === "usuarios" ? "is-active" : ""} href="/tpv/admin/usuarios">Usuarios</Link>
        </nav>
      </aside>

      <section className="tpv-admin-main">{children}</section>
    </main>
  );
}
