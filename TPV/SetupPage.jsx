"use client";

import { useState } from "react";

export default function SetupPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo crear el administrador");
      setDone(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="tpv-page tpv-home">
      <section className="tpv-login-shell">
        <div className="tpv-login-panel">
          <div>
            <p className="tpv-kicker">Configuracion inicial</p>
            <h1>Crear administrador</h1>
          </div>

          {done ? (
            <div className="tpv-products-panel">
              <div className="tpv-status is-active">Administrador creado</div>
              <a className="tpv-button" href="/tpv/login">Ir al login</a>
            </div>
          ) : (
            <form className="tpv-login-form" onSubmit={handleSubmit}>
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

              {error && <div className="tpv-error">{error}</div>}

              <button className="tpv-button" type="submit" disabled={loading}>
                {loading ? "Creando..." : "Crear administrador"}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
