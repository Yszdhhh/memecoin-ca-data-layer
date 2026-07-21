import { execFileSync } from "node:child_process";
import { REPO_ROOT } from "./files.js";

function git(args: string[]): string {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function gitCommit(): string {
  try {
    return git(["rev-parse", "HEAD"]);
  } catch {
    return "UNBORN";
  }
}

export function gitIsRepository(): boolean {
  try {
    return git(["rev-parse", "--is-inside-work-tree"]) === "true";
  } catch {
    return false;
  }
}

export function gitChangedPaths(sinceCommit?: string): string[] {
  const paths = new Set<string>();
  try {
    const args = sinceCommit && sinceCommit !== "UNBORN"
      ? ["diff", "--name-only", sinceCommit, "HEAD"]
      : ["diff", "--name-only"];
    for (const item of git(args).split(/\r?\n/).filter(Boolean)) paths.add(item.replaceAll("\\", "/"));
  } catch {
    // Doctor reports repository problems separately.
  }
  try {
    for (const item of git(["diff", "--name-only"]).split(/\r?\n/).filter(Boolean)) paths.add(item.replaceAll("\\", "/"));
    for (const item of git(["ls-files", "--others", "--exclude-standard"]).split(/\r?\n/).filter(Boolean)) paths.add(item.replaceAll("\\", "/"));
  } catch {
    // Doctor reports repository problems separately.
  }
  return [...paths].sort();
}

export function gitDirty(): boolean {
  try {
    return git(["status", "--porcelain"]).length > 0;
  } catch {
    return true;
  }
}

export function gitTrackedFiles(): string[] {
  try {
    return git(["ls-files"]).split(/\r?\n/).filter(Boolean).map((item) => item.replaceAll("\\", "/"));
  } catch {
    return [];
  }
}
