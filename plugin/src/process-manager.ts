import { spawn, type ChildProcess } from "node:child_process";
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

export class ProcessManager {
  private child: ChildProcess | null = null;
  private command: string;
  private cwd: string;
  private env: Record<string, string>;
  private logBuffer: LogBuffer;
  private appPort: number;
  private restarting = false;
  private restartCount = 0;

  constructor(opts: ProcessManagerOptions) {
    this.command = opts.command;
    this.cwd = opts.cwd;
    this.env = opts.env ?? {};
    this.logBuffer = opts.logBuffer;
    this.appPort = opts.appPort ?? 5173;
  }

  /** Start the app process. If already running, does nothing. */
  start(): void {
    if (this.child && !this.child.killed) {
      debug("start", "process already running, skipping");
      return;
    }

    const [cmd, ...args] = this.command.split(/\s+/);
    debug("start", `spawning: ${this.command} (cwd: ${this.cwd}, port: ${this.appPort})`);
    this.logBuffer.push("info", `[viagen:pm] Starting preview: ${this.command}`);

    this.child = spawn(cmd, args, {
      cwd: this.cwd,
      env: { ...process.env, ...this.env, PORT: String(this.appPort), __VIAGEN_CHILD: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      detached: false,
    });

    const pid = this.child.pid;
    debug("start", `process started (pid: ${pid})`);
    this.logBuffer.push("info", `[viagen:pm] Preview process started (pid: ${pid})`);

    this.child.stdout?.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        debug("stdout", line);
        this.logBuffer.push("info", `[preview] ${line}`);
      }
    });

    this.child.stderr?.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        debug("stderr", line);
        this.logBuffer.push("error", `[preview] ${line}`);
      }
    });

    this.child.on("exit", (code, signal) => {
      debug("exit", `process exited (code: ${code}, signal: ${signal})`);
      this.logBuffer.push(
        code === 0 ? "info" : "warn",
        `[viagen:pm] Preview process exited (code: ${code}, signal: ${signal})`,
      );
      this.child = null;

      // Auto-restart on crash (but not if we're doing a deliberate restart)
      if (!this.restarting && code !== 0 && code !== null) {
        this.restartCount++;
        if (this.restartCount <= 3) {
          const delay = this.restartCount * 2000;
          this.logBuffer.push("warn", `[viagen:pm] Auto-restarting in ${delay / 1000}s (attempt ${this.restartCount}/3)`);
          setTimeout(() => this.start(), delay);
        } else {
          this.logBuffer.push("error", `[viagen:pm] Preview crashed ${this.restartCount} times, giving up`);
        }
      }
    });

    this.child.on("error", (err) => {
      debug("error", `spawn error: ${err.message}`);
      this.logBuffer.push("error", `[viagen:pm] Failed to start preview: ${err.message}`);
      this.child = null;
    });
  }

  /** Stop the app process. Returns when the process has exited. */
  async stop(): Promise<void> {
    if (!this.child || this.child.killed) {
      debug("stop", "no process to stop");
      return;
    }

    const pid = this.child.pid;
    debug("stop", `killing process (pid: ${pid})`);
    this.logBuffer.push("info", `[viagen:pm] Stopping preview (pid: ${pid})`);

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        debug("stop", "SIGTERM timeout, sending SIGKILL");
        this.child?.kill("SIGKILL");
      }, 5000);

      this.child!.once("exit", () => {
        clearTimeout(timeout);
        this.child = null;
        debug("stop", "process stopped");
        this.logBuffer.push("info", "[viagen:pm] Preview stopped");
        resolve();
      });

      this.child!.kill("SIGTERM");
    });
  }

  /** Restart the app process, optionally with a new command. */
  async restart(newCommand?: string): Promise<string> {
    this.restarting = true;
    this.restartCount = 0;

    if (newCommand) {
      debug("restart", `changing command to: ${newCommand}`);
      this.logBuffer.push("info", `[viagen:pm] Changing preview command to: ${newCommand}`);
      this.command = newCommand;
    }

    debug("restart", "restarting preview process");
    this.logBuffer.push("info", "[viagen:pm] Restarting preview...");

    await this.stop();
    this.start();

    this.restarting = false;
    return `Preview restarted with: ${this.command}`;
  }

  /** Check if the process is currently running. */
  get running(): boolean {
    return this.child !== null && !this.child.killed;
  }

  /** Get the current command. */
  get currentCommand(): string {
    return this.command;
  }
}
