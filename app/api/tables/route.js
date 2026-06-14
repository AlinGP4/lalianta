import { createNextTable, listTables } from "../../../Backend/tables";

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

export async function POST() {
  try {
    const table = await createNextTable();
    return Response.json({ table }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
