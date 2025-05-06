import { ExifTool } from "exiftool-vendored";
import { readFile, writeFile } from "node:fs/promises";

let inUse = false;

export async function stripExif(
  file: File,
  id: string,
): Promise<{ success: true; file: Buffer } | { success: false }> {
  if (inUse) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(stripExif(file, id));
      }, 100);
    });
  }

  console.log("[exif] initating");

  inUse = true;
  const exiftool = new ExifTool();
  try {
    console.log("[exif] saving file");
    await writeFile(`/tmp/${encodeURIComponent(id)}`, Buffer.from(await file.arrayBuffer()));

    console.log("[exif] writing exif data");
    await exiftool.write(
      `/tmp/${encodeURIComponent(id)}`,
      {},
      { writeArgs: ["-all=", "-Orientation:all", "-icc_profile:all"] },
    );

    console.log("[exif] ending");
    await exiftool.end();

    inUse = false;

    return { success: true, file: await readFile(`/tmp/${encodeURIComponent(id)}`) };
  } catch (e) {
    inUse = false;
    console.error(e);
    await exiftool.end();
    return { success: false };
  } finally {
    await exiftool.end();
    inUse = false;
  }
}
