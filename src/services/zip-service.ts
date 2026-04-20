import { createWriteStream } from "node:fs";
import archiver from "archiver";

export interface ZipEntry {
  sourcePath: string;
  archiveName: string;
}

export async function createZipArchive(
  outputPath: string,
  entries: ZipEntry[],
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    output.on("close", () => resolve());
    output.on("error", (error) => reject(error));
    archive.on("error", (error) => reject(error));

    archive.pipe(output);

    for (const entry of entries) {
      archive.file(entry.sourcePath, { name: entry.archiveName });
    }

    archive.finalize().catch(reject);
  });
}
