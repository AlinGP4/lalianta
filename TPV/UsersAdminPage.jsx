"use client";

import { useEffect, useState } from "react";
import AdminShell from "./AdminShell";

export default function UsersAdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "worker",
  });

  useEffect(() => {
    async function loadUsers() {
      try {
        const response = await fetch("/api/users", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudieron cargar los usuarios");
        setUsers(data.users);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo crear el usuario");

      setUsers((current) => [...current, data.user]);
      setForm({ name: "", email: "", password: "", role: "worker" });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell active="usuarios">
      <header className="tpv-admin-head">
        <div>
          <p className="tpv-kicker">TPV Administracion</p>
          <h1>Usuarios</h1>
        </div>
      </header>

      <section className="tpv-panel tpv-products-panel">
        <div className="tpv-panel-head">
          <div>
            <h2>Alta de usuarios</h2>
            <span className="tpv-ticket-muted">Administradores y trabajadores</span>
          </div>
        </div>

        <form className="tpv-product-form" onSubmit={handleSubmit}>
          <label>
            <span>Nombre</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </label>

          <label>
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              required
            />
          </label>

          <label>
            <span>Clave</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              required
            />
          </label>

          <label>
            <span>Rol</span>
            <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
              <option value="worker">Trabajador</option>
              <option value="admin">Administrador</option>
            </select>
          </label>

          <div className="tpv-form-actions">
            <button className="tpv-button" type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Crear usuario"}
            </button>
          </div>
        </form>

        {error && <div className="tpv-error">{error}</div>}

        <div className="tpv-table-wrap">
          <table className="tpv-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="4">Cargando usuarios...</td>
                </tr>
              )}
              {!loading && users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role === "admin" ? "Administrador" : "Trabajador"}</td>
                  <td><span className={user.active ? "tpv-status is-active" : "tpv-status"}>{user.active ? "Activo" : "Inactivo"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
