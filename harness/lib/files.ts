import { createHash } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

export const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

export function resolveRepoPath(relativePath: string): string {
  const absolute = path.resolve(REPO_ROOT, relativePath);
  const relative = path.relative(REPO_ROOT, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escapes repository: ${relativePath}`);
  }
  return absolute;
}

export function toRepoPath(absolutePath: string): string {
  return path.relative(REPO_ROOT, absolutePath).replaceAll("\\", "/");
}

export async function readJson<T>(relativeOrAbsolutePath: string): Promise<T> {
  const absolute = path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : resolveRepoPath(relativeOrAbsolutePath);
  return JSON.parse(await readFile(absolute, "utf8")) as T;
}

export async function writeJson(relativeOrAbsolutePath: string, value: unknown): Promise<void> {
  const absolute = path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : resolveRepoPath(relativeOrAbsolutePath);
  await writeFile(absolute, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function exists(relativePath: string): Promise<boolean> {
  try {
    await access(resolveRepoPath(relativePath), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function sha256(relativePath: string): Promise<string | null> {
  try {
    const bytes = await readFile(resolveRepoPath(relativePath));
    return createHash("sha256").update(bytes).digest("hex");
  } catch {
    return null;
  }
}

export function globMatches(pattern: string, candidate: string): boolean {
  const normalizedPattern = pattern.replaceAll("\\", "/");
  const normalizedCandidate = candidate.replaceAll("\\", "/");
  const escaped = normalizedPattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const regex = escaped
    .replaceAll("**", "__DOUBLE_STAR__")
    .replaceAll("*", "[^/]*")
    .replaceAll("__DOUBLE_STAR__", ".*");
  return new RegExp(`^${regex}$`).test(normalizedCandidate);
}
