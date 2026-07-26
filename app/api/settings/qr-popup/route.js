import { readSessionToken } from "../../../../Backend/auth";
import { clearCustomerQrPopup, getCustomerQrPopup, setCustomerQrPopup } from "../../../../Backend/settings";
import { randomUUID } from "crypto";
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const uploadDirectory = path.join(process.cwd(), "public", "uploads");

/**
 * El tipo se decide por los bytes del archivo, no por el mime que declara el
 * navegador: hay equipos que envían image/png para un webp o un jpg y la imagen
 * acababa guardada con la extensión equivocada.
 */
const imageSignatures = [
  {
    extension: "png",
    mimeType: "image/png",
    matches: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    extension: "jpg",
    mimeType: "image/jpeg",
    matches: (buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  {
    extension: "gif",
    mimeType: "image/gif",
    matches: (buffer) => ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("latin1")),
  },
  {
    extension: "webp",
    mimeType: "image/webp",
    matches: (buffer) => (
      buffer.subarray(0, 4).toString("latin1") === "RIFF"
      && buffer.subarray(8, 12).toString("latin1") === "WEBP"
    ),
  },
];

function detectImageType(buffer) {
  if (buffer.length < 12) return null;
  return imageSignatures.find((signature) => signature.matches(buffer)) ?? null;
}

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

    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(
        `La imagen no puede superar 4 MB (esta ocupa ${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const imageType = detectImageType(buffer);
    if (!imageType) {
      throw new Error("El archivo tiene que ser una imagen PNG, JPG, WEBP o GIF.");
    }

    const previousPopup = await getCustomerQrPopup();
    await mkdir(uploadDirectory, { recursive: true });
    const fileName = `qr-popup-${randomUUID()}.${imageType.extension}`;
    await writeFile(path.join(uploadDirectory, fileName), buffer);
    await removeLocalPopupFile(previousPopup.imageUrl);

    const imageUrl = `/uploads/${fileName}`;
    const popup = await setCustomerQrPopup({
      fileName: file.name || "popup",
      imageUrl,
      mimeType: imageType.mimeType,
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
