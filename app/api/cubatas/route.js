import { readSessionToken } from "../../../Backend/auth";
import { listCubataMixerConfigs, setCubataMixerConfig } from "../../../Backend/cubatas";

export const runtime = "nodejs";

async function requireAdmin(request) {
  const token = request.cookies.get("tpv_session")?.value;
  const session = await readSessionToken(token);
  if (!session || session.role !== "admin") {
    throw new Error("No autorizado");
  }
}

export async function GET() {
  try {
    const configs = await listCubataMixerConfigs();
    return Response.json({ configs });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    await requireAdmin(request);
    const payload = await request.json();
    const configs = await setCubataMixerConfig(payload.alcoholProductId, payload.mixerProductIds);
    return Response.json({ configs });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
