import sharp from "sharp";

export const imageFormats: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/tiff": "tiff",
  "image/avif": "heif",
  "image/heic": "heif",
  "image/heif": "heif",
  "image/gif": "gif",
};

export const MAX_IMAGE_BYTES = 50_000_000;

// As in HRCT's gallery, re-encoding strips metadata and applies EXIF orientation.
// Keep the original dimensions for file storage and bound decoded image memory.
let processing: Promise<void> = Promise.resolve();

export async function processImage(source: Buffer, contentType: string): Promise<Buffer> {
  const previous = processing;

  let release!: () => void;

  processing = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;

  try {
    const image = sharp(source, { failOn: "warning", limitInputPixels: 50_000_000 });

    const metadata = await image.metadata();

    if (metadata.format !== imageFormats[contentType])
      throw new Error("Image contents do not match its content type");

    if (!metadata.width || !metadata.height) throw new Error("Image dimensions could not be read");

    if ((metadata.pages ?? 1) !== 1)
      throw new Error("Animated and multipage images are not supported");

    return await image.autoOrient().webp({ quality: 85 }).toBuffer();
  } finally {
    release();
  }
}
