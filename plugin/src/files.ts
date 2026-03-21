import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  statSync,
} from "node:fs";
import { join, resolve, relative, basename, dirname } from "node:path";
import type { IncomingMessage } from "node:http";
import type { ViteDevServer } from "vite";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

/**
 * Recursively collect all files under a directory, returning paths
 * relative to projectRoot. Skips node_modules and .git.
 */
function collectFiles(dir: string, projectRoot: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        results.push(...collectFiles(fullPath, projectRoot));
      } else if (entry.isFile()) {
        results.push(relative(projectRoot, fullPath));
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
  return results;
}

/**
 * Resolves editable patterns (relative to projectRoot) into absolute paths.
 */
export function resolveEditablePatterns(
  patterns: string[],
  projectRoot: string,
): string[] {
  return patterns.map((p) => resolve(projectRoot, p));
}

/**
 * Resolves the editable patterns to a flat list of relative file paths.
 * Directories are expanded to their contents. Files are included directly.
 * Paths are relative to projectRoot (may include ../ for paths above root).
 */
export function resolveEditableFiles(
  resolvedPatterns: string[],
  projectRoot: string,
): string[] {
  const files: string[] = [];
  for (const abs of resolvedPatterns) {
    try {
      const stat = statSync(abs);
      if (stat.isDirectory()) {
        files.push(...collectFiles(abs, projectRoot));
      } else if (stat.isFile()) {
        files.push(relative(projectRoot, abs));
      }
    } catch {
      // File/dir doesn't exist — skip
    }
  }
  return [...new Set(files)].sort();
}

/**
 * Validates that a requested path resolves to a location within
 * one of the resolved editable directories/files.
 */
export function isPathAllowed(
  requestedPath: string,
  resolvedPatterns: string[],
  projectRoot: string,
): boolean {
  // Block absolute paths in requests
  if (requestedPath.startsWith("/")) return false;

  const abs = resolve(projectRoot, requestedPath);

  for (const patternAbs of resolvedPatterns) {
    try {
      const stat = statSync(patternAbs);
      if (stat.isDirectory()) {
        if (abs.startsWith(patternAbs + "/")) return true;
      } else {
        if (abs === patternAbs) return true;
      }
    } catch {
      // Pattern doesn't exist on disk — check structurally
      if (abs.startsWith(patternAbs + "/")) return true;
      if (abs === patternAbs) return true;
    }
  }
  return false;
}

export function registerFileRoutes(
  server: ViteDevServer,
  opts: {
    editable: string[];
    projectRoot: string;
  },
) {
  // Pre-resolve editable patterns to absolute paths once
  const resolvedPatterns = resolveEditablePatterns(
    opts.editable,
    opts.projectRoot,
  );

  const MIME_TYPES: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
    ico: "image/x-icon",
    bmp: "image/bmp",
  };

  server.middlewares.use("/via/file/raw", (req, res) => {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end("Method not allowed");
      return;
    }
    const url = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "localhost"}`,
    );
    const filePath = url.searchParams.get("path");
    if (!filePath) {
      res.statusCode = 400;
      res.end("Missing path parameter");
      return;
    }
    if (!isPathAllowed(filePath, resolvedPatterns, opts.projectRoot)) {
      res.statusCode = 403;
      res.end("Path not in editable list");
      return;
    }
    const abs = resolve(opts.projectRoot, filePath);
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    const mime = MIME_TYPES[ext] ?? "application/octet-stream";
    try {
      const data = readFileSync(abs);
      res.setHeader("Content-Type", mime);
      res.setHeader("Cache-Control", "no-cache");
      res.end(data);
    } catch {
      res.statusCode = 404;
      res.end("File not found");
    }
  });

  server.middlewares.use("/via/files", (req, res) => {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }
    const files = resolveEditableFiles(resolvedPatterns, opts.projectRoot);
    const projectName = basename(opts.projectRoot);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ files, projectName }));
  });

  server.middlewares.use("/via/file", async (req, res) => {
    const url = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "localhost"}`,
    );

    if (req.method === "GET") {
      const filePath = url.searchParams.get("path");
      if (!filePath) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing path parameter" }));
        return;
      }
      if (!isPathAllowed(filePath, resolvedPatterns, opts.projectRoot)) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: "Path not in editable list" }));
        return;
      }
      const abs = resolve(opts.projectRoot, filePath);
      try {
        const content = readFileSync(abs, "utf-8");
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ path: filePath, content }));
      } catch {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "File not found" }));
      }
      return;
    }

    if (req.method === "POST") {
      let body: { path?: string; content?: string; encoding?: string };
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
        return;
      }
      const writePath = body.path;
      const writeContent = body.content;
      if (!writePath || writeContent === undefined) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing path or content" }));
        return;
      }
      const isViagen = writePath.startsWith(".viagen/");
      if (
        !isViagen &&
        !isPathAllowed(writePath, resolvedPatterns, opts.projectRoot)
      ) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: "Path not in editable list" }));
        return;
      }
      const abs = resolve(opts.projectRoot, writePath);
      try {
        mkdirSync(dirname(abs), { recursive: true });
        if (body.encoding === "base64") {
          writeFileSync(abs, Buffer.from(writeContent, "base64"));
        } else {
          writeFileSync(abs, writeContent, "utf-8");
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ status: "ok", path: writePath }));
      } catch (err) {
        res.statusCode = 500;
        const msg = err instanceof Error ? err.message : String(err);
        res.end(JSON.stringify({ error: msg }));
      }
      return;
    }

    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed" }));
  });
}
