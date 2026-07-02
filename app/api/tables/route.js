import { createNextTable, createTable, listTables, setAllTablesActive } from "../../../Backend/tables";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") !== "false";
    const tables = await listTables({ includeInactive });

    return Response.json({ tables });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    let payload = {};
    try {
      payload = await request.json();
    } catch {
      payload = {};
    }

    const rawTableName = String(payload.tableName ?? payload.name ?? payload.tableNumber ?? "").trim();
    const table = rawTableName ? await createTable(rawTableName) : await createNextTable();
    return Response.json({ table }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export async function PATCH(request) {
  try {
    const payload = await request.json();
    const tables = await setAllTablesActive(payload.active);
    return Response.json({ tables });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
