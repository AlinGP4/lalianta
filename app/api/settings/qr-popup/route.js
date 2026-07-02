import { readSessionToken } from "../../../../Backend/auth";
import { clearCustomerQrPopup, getCustomerQrPopup, setCustomerQrPopup } from "../../../../Backend/settings";
import { randomUUID } from "crypto";
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const uploadDirectory = path.join(process.cwd(), "public", "uploads");
const allowedImageTypes = new Map([
  ["image/gif", "gif"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

async function requireAdmin(request) {
  const token = request.cookies.get("tpv_session")?.value;
  const session = await readSessionToken(token);
  if (!session || session.role !== "admin") {
    throw new Error("No autorizado");
  }
  return session;
}

async function removeLocalPopupFile(imageUrl) {
  if (!imageUrl?.startsWith("/uploads/qr-popup-")) return;

  try {
    await rm(path.join(process.cwd(), "public", imageUrl), { force: true });
  } catch {
    // Best effort cleanup only.
  }
}

export async function GET() {
  try {
    const popup = await getCustomerQrPopup();
    return Response.json({ popup });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await requireAdmin(request);
    const formData = await request.formData();
    const file = formData.get("image");

    if (!file || typeof file.arrayBuffer !== "function") {
      throw new Error("Sube una imagen para el popup.");
    }

    const extension = allowedImageTypes.get(file.type);
    if (!extension) {
      throw new Error("El archivo tiene que ser una imagen PNG, JPG, WEBP o GIF.");
    }

    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error("La imagen no puede superar 4 MB.");
    }

    const previousPopup = await getCustomerQrPopup();
    const buffer = Buffer.from(await file.arrayBuffer());
    await mkdir(uploadDirectory, { recursive: true });
    const fileName = `qr-popup-${randomUUID()}.${extension}`;
    await writeFile(path.join(uploadDirectory, fileName), buffer);
    await removeLocalPopupFile(previousPopup.imageUrl);

    const imageUrl = `/uploads/${fileName}`;
    const popup = await setCustomerQrPopup({
      fileName: file.name || "popup",
      imageUrl,
      mimeType: file.type,
    });

    return Response.json({ popup });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(request) {
  try {
    await requireAdmin(request);
    const previousPopup = await getCustomerQrPopup();
    const popup = await clearCustomerQrPopup();
    await removeLocalPopupFile(previousPopup.imageUrl);
    return Response.json({ popup });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
