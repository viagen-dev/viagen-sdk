import { spawn, type ChildProcess } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { debug as _debug } from "./debug";
import type { LogBuffer } from "./logger";

const debug = (label: string, ...args: unknown[]) => _debug(`pm:${label}`, ...args);

export interface ProcessManagerOptions {
  command: string;
  cwd: string;
  env?: Record<string, string>;
  logBuffer: LogBuffer;
  /** Port the app process listens on (used for health checks) */
  appPort?: number;
}

/**
 * Manages the app preview as a detached process that survives viagen restarts.
 *
 * On start, writes the child PID to `.viagen/app.pid`. On the next startup
 * (e.g. after a viagen update), checks if that PID is still alive and skips
 * spawning if so. This lets the viagen chat server restart independently
 * without tearing down the user's app.
 */
export class ProcessManager {
  private child: ChildProcess | null = null;
  private adoptedPid: number | null = null;
  private command: string;
  private cwd: string;
  private env: Record<string, string>;
  private logBuffer: LogBuffer;
  private appPort: number;
  private viagenDir: string;
  private pidFile: string;
  private stdoutLog: string;
  private stderrLog: string;
  private logTailInterval: ReturnType<typeof setInterval> | null = null;
  private stdoutOffset = 0;
  private stderrOffset = 0;
  private restarting = false;
  private restartCount = 0;

  constructor(opts: ProcessManagerOptions) {
    this.command = opts.command;
    this.cwd = opts.cwd;
    this.env = opts.env ?? {};
    this.logBuffer = opts.logBuffer;
    this.appPort = opts.appPort ?? 5173;

    this.viagenDir = join(this.cwd, ".viagen");
    mkdirSync(this.viagenDir, { recursive: true });
    this.pidFile = join(this.viagenDir, "app.pid");
    this.stdoutLog = join(this.viagenDir, "app.stdout.log");
    this.stderrLog = join(this.viagenDir, "app.stderr.log");
  }

  /** Start the app process. If already running (or adopted from a previous session), does nothing. */
  start(): void {
    if (this.child && !this.child.killed) {
      debug("start", "process already running (spawned), skipping");
      return;
    }

    // Check if a previous instance left a running process we can adopt
    const existingPid = this.readPid();
    if (existingPid && this.isProcessAlive(existingPid)) {
      debug("start", `adopting existing app process (pid: ${existingPid})`);
      this.logBuffer.push("info", `[viagen:pm] App already running from previous session (pid: ${existingPid})`);
      this.adoptedPid = existingPid;
      return;
    }

    // Stale pid file — clean it up
    if (existingPid) {
      debug("start", `stale pid file (pid: ${existingPid} not alive), removing`);
      this.removePid();
    }

    // The child process is the "real" app — it could be anything (Next.js,
    // Rails, a LAMP stack, etc.). We set PORT in the environment since most
    // frameworks respect it. The user can also bake the port into
    // VIAGEN_APP_COMMAND directly for frameworks that don't.
    // Truncate log files for a fresh start
    writeFileSync(this.stdoutLog, "");
    writeFileSync(this.stderrLog, "");
    this.stdoutOffset = 0;
    this.stderrOffset = 0;

    debug("start", `spawning: ${this.command} (cwd: ${this.cwd}, port: ${this.appPort})`);
    this.logBuffer.push("info", `[viagen:pm] Starting app: ${this.command} (PORT=${this.appPort})`);

    // Use file descriptors for stdio so the child is fully detached from
    // the parent's event loop — pipes would keep them coupled.
    const stdoutFd = openSync(this.stdoutLog, "a");
    const stderrFd = openSync(this.stderrLog, "a");

    this.child = spawn(this.command, [], {
      cwd: this.cwd,
      env: {
        ...process.env,
        ...this.env,
        PORT: String(this.appPort),
        __VIAGEN_CHILD: "1",
        // Child app runs without viagen auth — the app should handle its own
        // auth if needed. Viagen auth only protects the chat/AI server.
        VIAGEN_AUTH_TOKEN: "",
      },
      stdio: ["ignore", stdoutFd, stderrFd],
      shell: true,
      // Detached so the app survives if the viagen chat server restarts
      // (e.g. during a viagen dependency update in a sandbox).
      detached: true,
    });

    const pid = this.child.pid;
    debug("start", `process started (pid: ${pid})`);
    this.logBuffer.push("info", `[viagen:pm] App process started (pid: ${pid})`);

    // Persist PID so a future viagen instance can find and adopt this process
    if (pid) {
      this.writePid(pid);
    }

    // Unref so the parent can exit without waiting for the child
    this.child.unref();

    // Tail the log files to feed into the log buffer
    this.startLogTail();

    this.child.on("exit", (code, signal) => {
      debug("exit", `process exited (code: ${code}, signal: ${signal})`);
      this.logBuffer.push(
        code === 0 ? "info" : "warn",
        `[viagen:pm] App process exited (code: ${code}, signal: ${signal})`,
      );
      this.child = null;
      this.stopLogTail();
      this.removePid();

      // Auto-restart on crash (but not if we're doing a deliberate restart)
      if (!this.restarting && code !== 0 && code !== null) {
        // Check if the crash was a port conflict (EADDRINUSE) — these never
        // self-resolve, so retrying just wastes time and spams logs.
        if (this.lastStderrContainsPortConflict()) {
          this.logBuffer.push("error",
            `[viagen:pm] App failed due to port conflict. ` +
            `If viagen is installed as a Vite/Astro plugin, remove VIAGEN_APP_COMMAND from .env — ` +
            `it causes a duplicate dev server that competes for ports.`);
        } else {
          this.restartCount++;
          if (this.restartCount <= 3) {
            const delay = this.restartCount * 2000;
            this.logBuffer.push("warn", `[viagen:pm] Auto-restarting in ${delay / 1000}s (attempt ${this.restartCount}/3)`);
            setTimeout(() => this.start(), delay);
          } else {
            this.logBuffer.push("error", `[viagen:pm] App crashed ${this.restartCount} times, giving up`);
          }
        }
      }
    });

    this.child.on("error", (err) => {
      debug("error", `spawn error: ${err.message}`);
      this.logBuffer.push("error", `[viagen:pm] Failed to start app: ${err.message}`);
      this.child = null;
      this.stopLogTail();
      this.removePid();
    });
  }

  /** Stop the app process. Returns when the process has exited. */
  async stop(): Promise<void> {
    // If we adopted a process from a previous session, kill it by PID
    if (this.adoptedPid) {
      const pid = this.adoptedPid;
      debug("stop", `killing adopted process (pid: ${pid})`);
      this.logBuffer.push("info", `[viagen:pm] Stopping adopted app (pid: ${pid})`);
      try {
        process.kill(-pid, "SIGTERM"); // negative PID kills the process group
      } catch {
        // Process may already be gone
      }
      this.adoptedPid = null;
      this.removePid();

      // Give it a moment then SIGKILL if still alive
      await new Promise<void>((resolve) => {
        const check = () => {
          if (!this.isProcessAlive(pid)) {
            resolve();
            return;
          }
          try { process.kill(-pid, "SIGKILL"); } catch { /* noop */ }
          resolve();
        };
        setTimeout(check, 5000);
      });
      return;
    }

    if (!this.child || this.child.killed) {
      debug("stop", "no process to stop");
      return;
    }

    const pid = this.child.pid;
    debug("stop", `killing process (pid: ${pid})`);
    this.logBuffer.push("info", `[viagen:pm] Stopping app (pid: ${pid})`);

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        debug("stop", "SIGTERM timeout, sending SIGKILL");
        if (pid) {
          try { process.kill(-pid, "SIGKILL"); } catch { /* noop */ }
        }
      }, 5000);

      this.child!.once("exit", () => {
        clearTimeout(timeout);
        this.child = null;
        this.removePid();
        debug("stop", "process stopped");
        this.logBuffer.push("info", "[viagen:pm] App stopped");
        resolve();
      });

      // Kill the process group so child processes (e.g. npm -> node) all die
      if (pid) {
        try { process.kill(-pid, "SIGTERM"); } catch { /* noop */ }
      } else {
        this.child!.kill("SIGTERM");
      }
    });
  }

  /** Restart the app process, optionally with a new command. */
  async restart(newCommand?: string): Promise<string> {
    this.restarting = true;
    this.restartCount = 0;

    if (newCommand) {
      debug("restart", `changing command to: ${newCommand}`);
      this.logBuffer.push("info", `[viagen:pm] Changing app command to: ${newCommand}`);
      this.command = newCommand;
    }

    debug("restart", "restarting app process");
    this.logBuffer.push("info", "[viagen:pm] Restarting app...");

    await this.stop();
    this.start();

    this.restarting = false;
    return `App restarted with: ${this.command}`;
  }

  /** Check if the process is currently running. */
  get running(): boolean {
    if (this.adoptedPid) return this.isProcessAlive(this.adoptedPid);
    return this.child !== null && !this.child.killed;
  }

  /** Get the current command. */
  get currentCommand(): string {
    return this.command;
  }

  // ── Log tailing ───────────────────────────────────────────────

  /** Poll log files and feed new lines into the log buffer. */
  private startLogTail(): void {
    this.stopLogTail();
    this.logTailInterval = setInterval(() => this.tailLogs(), 1000);
  }

  private stopLogTail(): void {
    if (this.logTailInterval) {
      clearInterval(this.logTailInterval);
      this.logTailInterval = null;
    }
    // Flush remaining logs
    this.tailLogs();
  }

  private tailLogs(): void {
    this.stdoutOffset = this.tailFile(this.stdoutLog, this.stdoutOffset, "info");
    this.stderrOffset = this.tailFile(this.stderrLog, this.stderrOffset, "error");
  }

  /** Read new bytes from a log file starting at offset. Returns new offset. */
  private tailFile(filePath: string, offset: number, level: "info" | "error"): number {
    try {
      if (!existsSync(filePath)) return offset;
      const stat = statSync(filePath);
      if (stat.size <= offset) return offset;

      const buf = Buffer.alloc(stat.size - offset);
      const fd = openSync(filePath, "r");
      const bytesRead = readSync(fd, buf, 0, buf.length, offset);
      closeSync(fd);

      if (bytesRead > 0) {
        const lines = buf.toString("utf-8", 0, bytesRead).split("\n").filter(Boolean);
        for (const line of lines) {
          debug(level === "info" ? "stdout" : "stderr", line);
          this.logBuffer.push(level, `[preview] ${line}`);
        }
      }
      return offset + bytesRead;
    } catch {
      return offset;
    }
  }

  // ── PID file helpers ──────────────────────────────────────────

  private writePid(pid: number): void {
    try {
      writeFileSync(this.pidFile, String(pid));
      debug("pid", `wrote pid ${pid} to ${this.pidFile}`);
    } catch (err) {
      debug("pid", `failed to write pid file: ${err}`);
    }
  }

  private readPid(): number | null {
    try {
      if (!existsSync(this.pidFile)) return null;
      const raw = readFileSync(this.pidFile, "utf-8").trim();
      const pid = parseInt(raw, 10);
      return Number.isFinite(pid) ? pid : null;
    } catch {
      return null;
    }
  }

  private removePid(): void {
    try {
      if (existsSync(this.pidFile)) unlinkSync(this.pidFile);
    } catch {
      // best effort
    }
  }

  /** Check if recent stderr output contains a port-in-use error. */
  private lastStderrContainsPortConflict(): boolean {
    try {
      if (!existsSync(this.stderrLog)) return false;
      const content = readFileSync(this.stderrLog, "utf-8");
      // Check the last 2KB for port conflict indicators
      const tail = content.slice(-2048);
      return /port\s+\d+\s+is\s+already\s+in\s+use/i.test(tail) ||
             /EADDRINUSE/i.test(tail);
    } catch {
      return false;
    }
  }

  private isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0); // signal 0 = existence check, doesn't actually kill
      return true;
    } catch {
      return false;
    }
  }
}
