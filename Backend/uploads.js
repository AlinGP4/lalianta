import path from "path";

/**
 * Las imágenes se guardan en public/uploads (ahí monta el volumen de Docker),
 * pero NO se sirven como estático: Next lee la carpeta public al arrancar, así
 * que un archivo subido después responde 404 hasta reiniciar el servidor.
 * Por eso las URLs apuntan a /api/uploads/<archivo>, que lee del disco.
 */
export const uploadDirectory = path.join(process.cwd(), "public", "uploads");

export const uploadContentTypes = new Map([
  ["gif", "image/gif"],
  ["jpeg", "image/jpeg"],
  ["jpg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
]);

const uploadFileNamePattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export function buildUploadUrl(fileName) {
  return `/api/uploads/${fileName}`;
}

/**
 * Nombre de archivo a partir de una URL guardada. Acepta las URLs antiguas
 * (/uploads/...) para que los popups subidos antes sigan funcionando.
 */
export function getUploadFileName(imageUrl) {
  const value = String(imageUrl ?? "");
  const match = value.match(/^\/(?:api\/)?uploads\/([^/?#]+)$/);
  if (!match) return "";

  return isSafeUploadFileName(match[1]) ? match[1] : "";
}

export function isSafeUploadFileName(fileName) {
  if (!fileName || fileName.includes("/") || fileName.includes("\\")) return false;
  if (fileName.includes("..")) return false;
  return uploadFileNamePattern.test(fileName);
}

export function getUploadContentType(fileName) {
  const extension = path.extname(fileName).replace(".", "").toLowerCase();
  return uploadContentTypes.get(extension) ?? "application/octet-stream";
}

export function normalizeUploadUrl(imageUrl) {
  const fileName = getUploadFileName(imageUrl);
  return fileName ? buildUploadUrl(fileName) : String(imageUrl ?? "");
}
