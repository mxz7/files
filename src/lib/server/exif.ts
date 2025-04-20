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

  inUse = true;
  const exiftool = new ExifTool();
  try {
    await writeFile(`/tmp/${id}`, Buffer.from(await file.arrayBuffer()));

    await exiftool.write(
      `/tmp/${id}`,
      {},
      { writeArgs: ["-all=", "-Orientation:all", "-icc_profile:all"] },
    );

    await exiftool.end();

    inUse = false;

    return { success: true, file: await readFile(`/tmp/${id}`) };
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
