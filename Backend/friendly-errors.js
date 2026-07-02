export function getFriendlyDatabaseErrorMessage(error, fallback = "No se pudo completar la acción") {
  const message = String(error?.message ?? "");
  const constraint = String(error?.constraint ?? "");
  const detail = String(error?.detail ?? "");
  const code = String(error?.code ?? "");
  const combined = `${message} ${constraint} ${detail}`;

  if (combined.includes("tpv_users_role_check") && (code === "42710" || combined.includes("already exists"))) {
    return "La regla de roles ya estaba creada en la base de datos. Recarga la página y vuelve a intentarlo.";
  }

  if (combined.includes("tpv_users_role_check")) {
    return "No se pudo guardar el rol del usuario. Usa solo estos roles: admin, barra, cocina o camarero.";
  }

  if (combined.includes("tpv_users_name_unique")) {
    return "Ya existe un usuario con ese nombre. Elige otro usuario para continuar.";
  }

  if (combined.includes("tpv_users_email_key")) {
    return "Ese usuario coincide con otro registro interno. Cambia ligeramente el nombre e inténtalo de nuevo.";
  }

  if (combined.includes("tpv_tables_table_number_key")) {
    return "Ya existe una mesa con ese número. Elige otro número o usa Nueva mesa +1.";
  }

  if (code === "42710" || (combined.includes("already exists") && combined.includes("constraint"))) {
    return "La base de datos ya tenía esa regla creada. Recarga la página e inténtalo de nuevo.";
  }

  if (code === "23505" || combined.includes("duplicate key value")) {
    return "Ya existe un registro con esos datos. Revisa la información e inténtalo de nuevo.";
  }

  if (code === "23514" || combined.includes("violates check constraint")) {
    return "Algún dato no cumple las reglas permitidas. Revisa los campos e inténtalo de nuevo.";
  }

  return message || fallback;
}

export function toFriendlyDatabaseError(error, fallback) {
  const friendlyMessage = getFriendlyDatabaseErrorMessage(error, fallback);

  if (!friendlyMessage || friendlyMessage === error?.message) {
    return error;
  }

  const friendlyError = new Error(friendlyMessage);
  friendlyError.cause = error;
  friendlyError.code = error?.code;
  friendlyError.constraint = error?.constraint;
  return friendlyError;
}
