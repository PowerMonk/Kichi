import { createWriteStream } from "node:fs";
import archiver from "archiver";

/**
 * Entry in a ZIP archive.
 * Specifies source file path and the name it should have inside the archive.
 */
export interface ZipEntry {
  sourcePath: string; // Absolute path to file on server
  archiveName: string; // Name file will have inside ZIP
}

/**
 * Creates a ZIP archive containing specified files.
 * Uses streaming to handle large batches efficiently.
 * Compresses with maximum compression level (zlib level 9).
 * Waits for the entire archive to be written to disk.
 */
export async function createZipArchive(
  outputPath: string, // Absolute path where ZIP file will be saved
  entries: ZipEntry[], // Files to include in the ZIP
): Promise<void> {
  // Wrap archive creation in a Promise for async/await support
  await new Promise<void>((resolve, reject) => {
    // Create write stream to save ZIP file to disk
    const output = createWriteStream(outputPath);

    // Create archiver instance (ZIP format with maximum compression)
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression (0-9, 9 is max)
    });

    // Handle completion: resolve promise when ZIP is fully written
    output.on("close", () => resolve());

    // Handle write stream errors
    output.on("error", (error) => reject(error));

    // Handle archiver errors
    archive.on("error", (error) => reject(error));

    // Pipe archive data to output file stream
    archive.pipe(output);

    // Add each file entry to the archive
    for (const entry of entries) {
      archive.file(entry.sourcePath, { name: entry.archiveName });
    }

    // Finalize the archive (write end marker and close)
    archive.finalize().catch(reject);
  });
}
