// Shrinks a photo to fit the free-plan 900 KB upload limit (Firestore document size) by
// downscaling to at most 1280px and lowering JPEG quality until it fits.
export async function compressImage(file: File, maxBytes = 850 * 1024): Promise<Blob> {
  if (file.size <= maxBytes && file.type === "image/jpeg") return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.8, 0.65, 0.5, 0.35]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= maxBytes) return blob;
  }
  throw new Error("image too large");
}
