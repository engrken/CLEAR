"use client";

/**
 * Prepare a header/logo image for its tiny printed presentation size.
 * Canvas WebP encoding retains transparency, unlike JPEG, while avoiding
 * uploads of multi-thousand-pixel logos into a small report header.
 *
 * The original is used if it is already small or optimization fails.
 * Server-side validation still limits each uploaded image to 5 MiB.
 */
export async function prepareReportLogo(file: File): Promise<File> {
  const types = new Set(["image/png", "image/jpeg", "image/webp"]);
  if (!types.has(file.type)) {
    throw new Error("Header logos must be PNG, JPEG or WebP images.");
  }
  const maxUpload = 5 * 1024 * 1024;
  if (file.size > maxUpload) {
    throw new Error("Header logos must be 5 MB or smaller.");
  }

  if (file.size <= 600 * 1024) return file;

  let objectUrl: string | undefined;
  try {
    objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Cannot read the selected logo image."));
      image.src = objectUrl!;
    });
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    if (!sourceWidth || !sourceHeight) throw new Error("Image has invalid dimensions.");

    const scale = Math.min(1, 1200 / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const encoded = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((blob) => resolve(blob), "image/webp", 0.92)
    );
    // Browsers unable to encode WebP may silently use PNG instead.
    if (!encoded || encoded.size >= file.size || !types.has(encoded.type)) return file;
    const ext = encoded.type === "image/webp" ? "webp" : encoded.type === "image/png" ? "png" : "jpg";
    const filename = file.name.replace(/\.[^.]+$/, "") + "." + ext;
    return new File([encoded], filename, { type: encoded.type, lastModified: file.lastModified });
  } catch {
    // Let the existing server action perform the authoritative validation.
    return file;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
