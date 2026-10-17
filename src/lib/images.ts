export async function fileToJpegDataUrl(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Elige una foto en JPG, PNG o WEBP.");
  }
  const bitmap = await createImageBitmap(file);
  const maxSide = 1000;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo preparar la foto.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.72);
  if (url.length > 450_000) {
    throw new Error("La foto sigue muy pesada. Prueba con otra más pequeña.");
  }
  return url;
}
