import { checkDatabaseConnection } from "../../../../Backend/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await checkDatabaseConnection();

    return Response.json({
      ok: true,
      databaseTime: data.now,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error.message,
      },
      { status: 500 },
    );
  }
}
