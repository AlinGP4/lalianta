import { readFile } from "fs/promises";
import path from "path";
import {
  getUploadContentType,
  isSafeUploadFileName,
  uploadDirectory,
} from "../../../../Backend/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { fileName } = await params;

  if (!isSafeUploadFileName(fileName)) {
    return Response.json({ error: "Archivo no válido" }, { status: 400 });
  }

  try {
    const file = await readFile(path.join(uploadDirectory, fileName));

    return new Response(file, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": getUploadContentType(fileName),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "Archivo no encontrado" }, { status: 404 });
  }
}
