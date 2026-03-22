// Atomic file write utilities (Windows NTFS compatible)
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Atomically write content to a file.
 * Writes to a temp file in the same directory, then renames.
 * On Windows NTFS, rename within the same directory is atomic.
 */
export async function atomicWrite(
  filePath: string,
  content: string,
): Promise<void> {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tmpPath = path.join(dir, `.tmp_${Date.now()}_${base}`);

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(tmpPath, content, "utf-8");
  await fs.rename(tmpPath, filePath);
}

/**
 * Write a file, creating parent directories as needed (non-atomic).
 */
export async function writeFile(
  filePath: string,
  content: string,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
}

/**
 * Read a file, returning null if it does not exist.
 */
export async function readFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/**
 * Check whether a path exists (file or directory).
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
