import { exiftool } from "exiftool-vendored";
import { readFile, writeFile } from "node:fs/promises";

export async function stripExif(
  file: File,
  id: string,
): Promise<{ success: true; file: Buffer } | { success: false }> {
  try {
    console.log("[exif] saving file");
    await writeFile(`/tmp/${encodeURIComponent(id)}`, Buffer.from(await file.arrayBuffer()));

    console.log("[exif] writing exif data");

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
    console.error(e);
    return { success: false };
  }
}
