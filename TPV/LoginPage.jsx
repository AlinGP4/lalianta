"use client";

import { useState } from "react";

export default function LoginPage({ next = "", setupAvailable = false }) {
  const [form, setForm] = useState({ name: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo iniciar sesión");
      window.location.href = next || data.redirectTo || "/tpv";
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
            <p className="tpv-kicker">Zona privada</p>
            <h1>Acceso TPV</h1>
          </div>

          <form className="tpv-login-form" onSubmit={handleSubmit}>
            <label>
              <span>Usuario</span>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                autoComplete="username"
                required
              />
            </label>

            <label>
              <span>Clave</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                autoComplete="current-password"
                required
              />
            </label>

            {error && <div className="tpv-error">{error}</div>}

            <button className="tpv-button" type="submit" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </button>

            {setupAvailable && (
              <a className="tpv-button tpv-button-secondary" href="/tpv/setup">
                Configurar primer admin
              </a>
            )}
          </form>
        </div>
      </section>
    </main>
  );
}
