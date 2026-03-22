/**
 * Atomically write content to a file.
 * Writes to a temp file in the same directory, then renames.
 * On Windows NTFS, rename within the same directory is atomic.
 */
export declare function atomicWrite(filePath: string, content: string): Promise<void>;
/**
 * Write a file, creating parent directories as needed (non-atomic).
 */
export declare function writeFile(filePath: string, content: string): Promise<void>;
/**
 * Read a file, returning null if it does not exist.
 */
export declare function readFile(filePath: string): Promise<string | null>;
/**
 * Check whether a path exists (file or directory).
 */
export declare function fileExists(filePath: string): Promise<boolean>;
//# sourceMappingURL=file-writer.d.ts.map