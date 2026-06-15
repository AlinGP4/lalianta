"use client";

import { Check, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "worker",
  active: true,
};

export default function UsersAdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingUserId, setEditingUserId] = useState("");
  const [editForm, setEditForm] = useState(emptyForm);

  async function loadUsers() {
    setLoading(true);
    setError("");

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

  useEffect(() => {
    loadUsers();
  }, []);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateEditField(field, value) {
    setEditForm((current) => ({ ...current, [field]: value }));
  }

  function editUser(user) {
    setEditingUserId(user.id);
    setEditForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      active: user.active,
    });
    setError("");
  }

  function resetForm() {
    setForm(emptyForm);
    setError("");
  }

  function cancelEdit() {
    setEditingUserId("");
    setEditForm(emptyForm);
    setError("");
  }

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

      await loadUsers();
      resetForm();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveInlineUser(user) {
    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo actualizar el usuario");

      await loadUsers();
      cancelEdit();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeUser(user) {
    const confirmed = window.confirm(`Borrar ${user.name}?`);
    if (!confirmed) return;

    setError("");

    try {
      const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo borrar el usuario");
      await loadUsers();
      if (editingUserId === user.id) cancelEdit();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <>
      <header className="tpv-admin-head">
        <div>
          <p className="tpv-kicker">TPV Administración</p>
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
              onChange={(event) => updateField("name", event.target.value)}
              required
            />
          </label>

          <label>
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              required
            />
          </label>

          <label>
            <span>Clave</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => updateField("password", event.target.value)}
              required
            />
          </label>

          <label>
            <span>Rol</span>
            <select value={form.role} onChange={(event) => updateField("role", event.target.value)}>
              <option value="worker">Trabajador</option>
              <option value="admin">Administrador</option>
            </select>
          </label>

          <label className="tpv-check">
            <input
              checked={form.active}
              type="checkbox"
              onChange={(event) => updateField("active", event.target.checked)}
            />
            <span>Activo</span>
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
                <th>Clave</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="6">Cargando usuarios...</td>
                </tr>
              )}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan="6">Todavía no hay usuarios.</td>
                </tr>
              )}
              {!loading && users.map((user) => {
                const isEditing = editingUserId === user.id;

                return (
                  <tr key={user.id}>
                    <td>
                      {isEditing ? (
                        <input
                          className="tpv-inline-field"
                          value={editForm.name}
                          onChange={(event) => updateEditField("name", event.target.value)}
                        />
                      ) : user.name}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="tpv-inline-field"
                          type="email"
                          value={editForm.email}
                          onChange={(event) => updateEditField("email", event.target.value)}
                        />
                      ) : user.email}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="tpv-inline-field"
                          type="password"
                          value={editForm.password}
                          onChange={(event) => updateEditField("password", event.target.value)}
                          placeholder="Sin cambio"
                        />
                      ) : <span className="tpv-ticket-muted">Sin cambio</span>}
                    </td>
                    <td>
                      {isEditing ? (
                        <select
                          className="tpv-inline-field"
                          value={editForm.role}
                          onChange={(event) => updateEditField("role", event.target.value)}
                        >
                          <option value="worker">Trabajador</option>
                          <option value="admin">Administrador</option>
                        </select>
                      ) : user.role === "admin" ? "Administrador" : "Trabajador"}
                    </td>
                    <td>
                      {isEditing ? (
                        <label className="tpv-inline-check">
                          <input
                            checked={editForm.active}
                            type="checkbox"
                            onChange={(event) => updateEditField("active", event.target.checked)}
                          />
                          <span>Activo</span>
                        </label>
                      ) : (
                        <span className={user.active ? "tpv-status is-active" : "tpv-status"}>
                          {user.active ? "Activo" : "Inactivo"}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="tpv-row-actions">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveInlineUser(user)}
                              aria-label={`Guardar ${user.name}`}
                              title="Guardar"
                              disabled={saving}
                            >
                              <Check aria-hidden="true" size={16} strokeWidth={2.2} />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              aria-label={`Cancelar edición de ${user.name}`}
                              title="Cancelar"
                            >
                              <X aria-hidden="true" size={16} strokeWidth={2.2} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => editUser(user)}
                              aria-label={`Editar ${user.name}`}
                              title="Editar"
                            >
                              <Pencil aria-hidden="true" size={16} strokeWidth={2.2} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeUser(user)}
                              aria-label={`Borrar ${user.name}`}
                              title="Borrar"
                            >
                              <Trash2 aria-hidden="true" size={16} strokeWidth={2.2} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
