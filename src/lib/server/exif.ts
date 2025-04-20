import { exiftool } from "exiftool-vendored";
import { readFile, writeFile } from "node:fs/promises";

let inUse = false;

export async function stripExif(
  file: File,
  id: string,
): Promise<{ success: true; file: Buffer } | { success: false }> {
  inUse = true;
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
    return { success: false };
  } finally {
    inUse = false;
  }
}
