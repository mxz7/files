import { readFile, writeFile } from "node:fs/promises";
import { baseLogger } from "#lib/server/logger.js";
import type { Logger } from "pino";

export async function stripExif(
  file: File,
  id: string,
  logger: Logger = baseLogger,
): Promise<{ success: true; file: Buffer } | { success: false }> {
  try {
    // EXIFTool needs process inspection; initialize it only when processing an upload.
    const { exiftool } = await import("exiftool-vendored");
    logger.debug({ upload_id: id }, "Saving file for EXIF removal");
    await writeFile(`/tmp/${encodeURIComponent(id)}`, Buffer.from(await file.arrayBuffer()));

    logger.debug({ upload_id: id }, "Removing EXIF metadata");

    await exiftool.write(
      `/tmp/${encodeURIComponent(id)}`,
      {},
      {
        writeArgs: [
          "-all=",
          "-tagsfromfile @ -all= -TagsFromFile @ -icc_profile -Orientation -overwrite_original",
        ],
      },
    );

    return { success: true, file: await readFile(`/tmp/${encodeURIComponent(id)}`) };
  } catch (e) {
    logger.error({ err: e, upload_id: id }, "Failed to strip EXIF data");
    return { success: false };
  }
}
