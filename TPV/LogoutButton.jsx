"use client";

export default function LogoutButton({ children = "Cerrar sesión", className = "" }) {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/tpv/login";
  }

  return (
    <button className={className} type="button" onClick={logout}>
      {children}
    </button>
  );
}
