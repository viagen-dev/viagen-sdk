import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Logger } from "vite";

export interface LogEntry {
  level: "info" | "warn" | "error";
  text: string;
  timestamp: number;
}

const MAX_LOG_LINES = 100;

// Strip ANSI escape codes (colors, bold, etc.) for clean display in the UI
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;

export class LogBuffer {
  private _entries: LogEntry[] = [];
  private logPath: string | undefined;

  init(projectRoot: string) {
    const dir = join(projectRoot, ".viagen");
    mkdirSync(dir, { recursive: true });
    this.logPath = join(dir, "server.log");
    this.flush();
  }

  push(level: LogEntry["level"], text: string) {
    this._entries.push({ level, text: text.replace(ANSI_RE, ""), timestamp: Date.now() });
    if (this._entries.length > MAX_LOG_LINES) {
      this._entries.shift();
    }
    this.flush();
  }

  getEntries(): readonly LogEntry[] {
    return this._entries;
  }

  recentErrors(): string[] {
    return this._entries
      .filter((e) => e.level === "error" || e.level === "warn")
      .map((e) => `[${e.level.toUpperCase()}] ${e.text}`);
  }

  private flush() {
    if (!this.logPath) return;
    const content = this._entries
      .map((e) => {
        const ts = new Date(e.timestamp).toISOString();
        return `[${ts}] [${e.level.toUpperCase()}] ${e.text}`;
      })
      .join("\n");
    writeFileSync(this.logPath, content + "\n");
  }
}

export function wrapLogger(logger: Logger, buffer: LogBuffer): void {
  const origInfo = logger.info.bind(logger);
  const origWarn = logger.warn.bind(logger);
  const origError = logger.error.bind(logger);

  logger.info = (msg, opts) => {
    buffer.push("info", msg);
    origInfo(msg, opts);
  };
  logger.warn = (msg, opts) => {
    buffer.push("warn", msg);
    origWarn(msg, opts);
  };
  logger.error = (msg, opts) => {
    buffer.push("error", msg);
    origError(msg, opts);
  };
}
