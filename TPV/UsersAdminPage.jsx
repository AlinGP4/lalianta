"use client";

import { Check, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ConfirmModal from "./ConfirmModal";

const emptyForm = {
  name: "",
  password: "",
  role: "barra",
};

const roleLabels = {
  admin: "Administrador",
  barra: "Barra",
  camarero: "Camarero",
  cocina: "Cocina",
};

function getRoleLabel(value) {
  return roleLabels[value] ?? "Barra";
}

function getFriendlyUserError(message) {
  const text = String(message || "");

  if (text.includes("regla de roles") || (text.includes("tpv_users_role_check") && text.includes("already exists"))) {
    return "La regla de roles ya estaba creada. Recarga usuarios y vuelve a intentarlo.";
  }

  if (text.includes("tpv_users_role_check")) {
    return "No se pudo guardar el rol. Usa solo admin, barra, cocina o camarero.";
  }

  if (text.includes("tpv_users_name_unique") || text.includes("Ya existe un usuario")) {
    return "Ya existe un usuario con ese nombre. Cambia el usuario e inténtalo de nuevo.";
  }

  if (text.includes("tpv_users_email_key")) {
    return "Ese usuario coincide con otro registro interno. Cambia ligeramente el nombre.";
  }

  if (text.includes("duplicate key") || text.includes("Ya existe un registro")) {
    return "Ya existe un registro con esos datos. Revisa el usuario antes de guardar.";
  }

  if (text.includes("check constraint") || text.includes("reglas permitidas")) {
    return "Algún dato no cumple las reglas permitidas. Revisa el rol y los campos obligatorios.";
  }

  if (text.includes("No autorizado")) {
    return "Solo un administrador puede gestionar usuarios.";
  }

  return text || "No se pudo completar la acción de usuarios.";
}

export default function UsersAdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingUserId, setEditingUserId] = useState("");
  const [editForm, setEditForm] = useState(emptyForm);
  const [confirmModal, setConfirmModal] = useState(null);
  const toastTimeoutRef = useRef(null);

  function showToast(message) {
    setToast(getFriendlyUserError(message));
    window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => setToast(""), 4200);
  }

  async function loadUsers() {
    setLoading(true);
    setToast("");

    try {
      const response = await fetch("/api/users", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar los usuarios");
      setUsers(data.users);
    } catch (requestError) {
      showToast(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();

    return () => {
      window.clearTimeout(toastTimeoutRef.current);
    };
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
      password: "",
      role: user.role,
    });
    setToast("");
  }

  function resetForm() {
    setForm(emptyForm);
    setToast("");
  }

  function cancelEdit() {
    setEditingUserId("");
    setEditForm(emptyForm);
    setToast("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setToast("");

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
      showToast(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveInlineUser(user) {
    setSaving(true);
    setToast("");

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
      showToast(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeUser(user) {
    setToast("");

    try {
      const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo borrar el usuario");
      await loadUsers();
      if (editingUserId === user.id) cancelEdit();
    } catch (requestError) {
      showToast(requestError.message);
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
            <span className="tpv-ticket-muted">Administradores, barra, cocina y camareros</span>
          </div>
        </div>

        <form className="tpv-product-form" onSubmit={handleSubmit}>
          <label>
            <span>Usuario</span>
            <input
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
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
              <option value="admin">Administrador</option>
              <option value="barra">Barra</option>
              <option value="camarero">Camarero</option>
              <option value="cocina">Cocina</option>
            </select>
          </label>

          <div className="tpv-form-actions">
            <button className="tpv-button" type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Crear usuario"}
            </button>
          </div>
        </form>

        <div className="tpv-table-wrap">
          <table className="tpv-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Clave</th>
                <th>Rol</th>
                <th className="tpv-actions-cell">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="4">Cargando usuarios...</td>
                </tr>
              )}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan="4">Todavía no hay usuarios.</td>
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
                          <option value="admin">Administrador</option>
                          <option value="barra">Barra</option>
                          <option value="camarero">Camarero</option>
                          <option value="cocina">Cocina</option>
                        </select>
                      ) : getRoleLabel(user.role)}
                    </td>
                    <td className="tpv-actions-cell">
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
                              onClick={() => setConfirmModal({
                                title: "Borrar usuario",
                                message: `Se borrará el usuario ${user.name}.`,
                                confirmLabel: "Borrar",
                                onConfirm: () => removeUser(user),
                              })}
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
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          onCancel={() => setConfirmModal(null)}
          onConfirm={() => {
            const action = confirmModal.onConfirm;
            setConfirmModal(null);
            action();
          }}
        />
      )}
      {toast && <div className="tpv-toast" role="status">{toast}</div>}
    </>
  );
}
