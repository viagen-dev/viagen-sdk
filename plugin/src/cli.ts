import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { createInterface } from "node:readline";
import { homedir } from "node:os";
import { deploySandbox, stopSandbox, collectFiles } from "./sandbox";
import { oauthMaxFlow, oauthConsoleFlow, refreshAccessToken } from "./oauth";
import type { GitInfo } from "./sandbox";
import {
  createViagen,
  ViagenApiError,
  saveCredentials,
  loadCredentials,
  clearCredentials,
} from "viagen-sdk";

function loadDotenv(dir: string): Record<string, string> {
  const envPath = join(dir, ".env");
  if (!existsSync(envPath)) return {};

  const vars: Record<string, string> = {};
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    vars[key] = val;
  }
  return vars;
}

function writeEnvVars(dir: string, vars: Record<string, string>) {
  const envPath = join(dir, ".env");
  let content = "";
  if (existsSync(envPath)) {
    content = readFileSync(envPath, "utf-8");
  }

  const existing = loadDotenv(dir);
  const toAdd: string[] = [];

  for (const [key, val] of Object.entries(vars)) {
    if (existing[key]) continue;
    toAdd.push(`${key}=${val}`);
  }

  if (toAdd.length === 0) return;

  if (content.length > 0 && !content.endsWith("\n")) {
    content += "\n";
  }
  content += toAdd.join("\n") + "\n";
  writeFileSync(envPath, content);
}

function updateEnvVars(dir: string, vars: Record<string, string>) {
  const envPath = join(dir, ".env");
  if (!existsSync(envPath)) return;

  let content = readFileSync(envPath, "utf-8");
  for (const [key, val] of Object.entries(vars)) {
    const re = new RegExp(`^${key}=.*$`, "m");
    if (re.test(content)) {
      content = content.replace(re, `${key}=${val}`);
    }
  }
  writeFileSync(envPath, content);
}

function openBrowser(url: string) {
  try {
    const platform = process.platform;
    if (platform === "darwin") execSync(`open "${url}"`);
    else if (platform === "linux") execSync(`xdg-open "${url}"`);
    else if (platform === "win32") execSync(`start "${url}"`);
  } catch {
    // Silent fail — user can open manually
  }
}

interface LocalGitInfo {
  remoteUrl: string;
  branch: string;
  userName: string;
  userEmail: string;
  isDirty: boolean;
}

function git(cwd: string, args: string): string {
  return execSync(`git ${args}`, {
    cwd,
    stdio: "pipe",
    encoding: "utf-8",
  }).trim();
}

function sshToHttps(url: string): string {
  if (url.startsWith("https://")) return url;
  if (url.startsWith("http://")) return url.replace(/^http:\/\//, "https://");

  const shorthand = url.match(/^[\w.-]+@([\w.-]+):([\w./_-]+)$/);
  if (shorthand) return `https://${shorthand[1]}/${shorthand[2]}`;

  const sshUrl = url.match(/^ssh:\/\/[\w.-]+@([\w.-]+)\/([\w./_-]+)$/);
  if (sshUrl) return `https://${sshUrl[1]}/${sshUrl[2]}`;

  return url;
}

function getGitInfo(cwd: string): LocalGitInfo | null {
  try {
    git(cwd, "rev-parse --is-inside-work-tree");
  } catch {
    return null;
  }

  try {
    const remoteUrlRaw = git(cwd, "remote get-url origin");
    const branch = git(cwd, "branch --show-current");
    const userName = git(cwd, "config user.name");
    const userEmail = git(cwd, "config user.email");
    const status = git(cwd, "status --porcelain");

    const remoteUrl = sshToHttps(remoteUrlRaw);
    if (!remoteUrl || !branch) return null;

    return {
      remoteUrl,
      branch,
      userName,
      userEmail,
      isDirty: status.length > 0,
    };
  } catch {
    return null;
  }
}

function remoteBranchExists(
  remoteUrl: string,
  branch: string,
  token: string,
): boolean {
  try {
    const url = new URL(remoteUrl);
    url.username = "x-access-token";
    url.password = token;
    const out = execSync(
      `git ls-remote --heads ${url.toString()} refs/heads/${branch}`,
      { encoding: "utf-8", stdio: "pipe" },
    ).trim();
    return out.length > 0;
  } catch {
    return false;
  }
}

/** Extract "owner/repo" from an HTTPS remote URL. */
function repoNwo(remoteUrl: string): string | null {
  const m = remoteUrl.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/);
  return m ? m[1] : null;
}

/**
 * Create a branch on the remote via `gh api`.
 * Returns true if the branch was created (or already existed).
 */
function createRemoteBranch(
  remoteUrl: string,
  branch: string,
  token: string,
): boolean {
  const nwo = repoNwo(remoteUrl);
  if (!nwo) return false;

  try {
    // Get the SHA of the default branch HEAD
    const sha = execSync(
      `gh api repos/${nwo}/git/ref/heads/main --jq .object.sha`,
      { encoding: "utf-8", stdio: "pipe", env: { ...process.env, GH_TOKEN: token } },
    ).trim();

    if (!sha) return false;

    execSync(
      `gh api repos/${nwo}/git/refs -f ref=refs/heads/${branch} -f sha=${sha}`,
      { encoding: "utf-8", stdio: "pipe", env: { ...process.env, GH_TOKEN: token } },
    );
    return true;
  } catch {
    return false;
  }
}

function promptUser(question: string): Promise<string> {
  if (!process.stdin.isTTY) return Promise.resolve("");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function shellOk(cmd: string): boolean {
  try {
    execSync(cmd, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function shellOutput(cmd: string): string | null {
  try {
    return execSync(cmd, { stdio: "pipe", encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

function getVercelConfigDir(): string {
  const platform = process.platform;
  if (platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "com.vercel.cli");
  } else if (platform === "win32") {
    return join(
      process.env["APPDATA"] || join(homedir(), "AppData", "Roaming"),
      "com.vercel.cli",
    );
  } else {
    return join(
      process.env["XDG_DATA_HOME"] || join(homedir(), ".local", "share"),
      "com.vercel.cli",
    );
  }
}

// ─── setup command ───────────────────────────────────────────────

async function setup() {
  const cwd = process.cwd();
  const existing = loadDotenv(cwd);
  const newVars: Record<string, string> = {};

  console.log("viagen setup");
  console.log("");

  // Step 1: Claude authentication
  let claudeExpired = false;
  if (existing["CLAUDE_ACCESS_TOKEN"] && existing["CLAUDE_TOKEN_EXPIRES"]) {
    const expires = parseInt(existing["CLAUDE_TOKEN_EXPIRES"], 10);
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec > expires) {
      // Try refreshing first
      if (existing["CLAUDE_REFRESH_TOKEN"]) {
        console.log("Claude auth ... token expired, attempting refresh...");
        try {
          const tokens = await refreshAccessToken(existing["CLAUDE_REFRESH_TOKEN"]);
          newVars["CLAUDE_ACCESS_TOKEN"] = tokens.access_token;
          newVars["CLAUDE_REFRESH_TOKEN"] = tokens.refresh_token;
          newVars["CLAUDE_TOKEN_EXPIRES"] = String(nowSec + tokens.expires_in);
          console.log("Claude auth ... refreshed");
        } catch {
          console.log("Claude auth ... refresh failed, need to re-authenticate");
          claudeExpired = true;
        }
      } else {
        console.log("Claude auth ... token expired, need to re-authenticate");
        claudeExpired = true;
      }
    } else {
      console.log("Claude auth ... already configured");
    }
  } else if (existing["ANTHROPIC_API_KEY"]) {
    console.log("Claude auth ... already configured");
  }

  if (claudeExpired || (!existing["ANTHROPIC_API_KEY"] && !existing["CLAUDE_ACCESS_TOKEN"])) {
    console.log("How do you want to authenticate with Claude?");
    console.log("");
    console.log("  1) Log in with Claude Max/Pro (recommended)");
    console.log("  2) Log in with Anthropic Console (creates API key)");
    console.log("  3) Paste an existing API key");
    console.log("");

    const choice = await promptUser("Choose [1/2/3]: ");

    if (choice === "1" || !choice) {
      const tokens = await oauthMaxFlow();
      newVars["CLAUDE_ACCESS_TOKEN"] = tokens.access_token;
      newVars["CLAUDE_REFRESH_TOKEN"] = tokens.refresh_token;
      newVars["CLAUDE_TOKEN_EXPIRES"] = String(
        Math.floor(Date.now() / 1000) + tokens.expires_in,
      );
      console.log("Claude auth ... Max/Pro tokens saved");
    } else if (choice === "2") {
      const apiKey = await oauthConsoleFlow();
      newVars["ANTHROPIC_API_KEY"] = apiKey;
      console.log("Claude auth ... API key created");
    } else {
      const key = await promptUser("Paste your ANTHROPIC_API_KEY: ");
      if (key) {
        newVars["ANTHROPIC_API_KEY"] = key;
        console.log("Claude auth ... API key saved");
      } else {
        console.log("Claude auth ... skipped");
      }
    }
  }

  console.log("");

  // Step 2: GitHub
  if (existing["GITHUB_TOKEN"]) {
    console.log("GitHub       ... already configured");
  } else if (!shellOk("which gh")) {
    console.log("GitHub CLI (gh) is not installed.");
    console.log("Without it, sandboxes can't commit or push changes.");
    console.log("");
    const install = await promptUser("Install gh now? [y/n]: ");
    if (install === "y" || install === "yes") {
      console.log("");
      console.log("Installing gh...");
      try {
        execSync("brew install gh", { stdio: "inherit" });
        console.log("");
        console.log("Running gh auth login...");
        execSync("gh auth login", { stdio: "inherit" });
        const token = shellOutput("gh auth token");
        if (token) {
          newVars["GITHUB_TOKEN"] = token;
          console.log("GitHub       ... configured");
        }
      } catch {
        console.log("GitHub       ... install failed, skipping");
      }
    } else {
      console.log("GitHub       ... skipped");
    }
  } else if (shellOk("gh auth status")) {
    const token = shellOutput("gh auth token");
    if (token) {
      newVars["GITHUB_TOKEN"] = token;
      console.log("GitHub       ... token from gh CLI");
    }
  } else {
    console.log("gh CLI is installed but not logged in.");
    console.log("Without it, sandboxes can't commit or push changes.");
    console.log("");
    const login = await promptUser("Run gh auth login now? [y/n]: ");
    if (login === "y" || login === "yes") {
      try {
        execSync("gh auth login", { stdio: "inherit" });
        const token = shellOutput("gh auth token");
        if (token) {
          newVars["GITHUB_TOKEN"] = token;
          console.log("GitHub       ... configured");
        }
      } catch {
        console.log("GitHub       ... login failed, skipping");
      }
    } else {
      console.log("GitHub       ... skipped");
    }
  }

  console.log("");

  // Step 3: Git repo info
  {
    const detectedGit = getGitInfo(cwd);
    const savedUrl = existing["GIT_REMOTE_URL"];

    if (savedUrl && detectedGit && savedUrl !== detectedGit.remoteUrl) {
      // Mismatch — the .env points somewhere different than the local remote
      console.log(`Git repo     ... mismatch!`);
      console.log(`  .env:   ${savedUrl}`);
      console.log(`  local:  ${detectedGit.remoteUrl}`);
      console.log("");
      const fix = await promptUser("Update .env to match local remote? [y/n]: ");
      if (fix === "y" || fix === "yes" || !fix) {
        newVars["GIT_REMOTE_URL"] = detectedGit.remoteUrl;
        newVars["GIT_BRANCH"] = detectedGit.branch;
        newVars["GIT_USER_NAME"] = detectedGit.userName;
        newVars["GIT_USER_EMAIL"] = detectedGit.userEmail;
        console.log("Git repo     ... updated");
      } else {
        console.log("Git repo     ... keeping .env value");
      }
    } else if (savedUrl) {
      console.log(`Git repo     ... ${savedUrl}`);
    } else if (detectedGit) {
      console.log(`Detected git remote: ${detectedGit.remoteUrl}`);
      console.log(`  Branch: ${detectedGit.branch}`);
      console.log(`  User:   ${detectedGit.userName} <${detectedGit.userEmail}>`);
      console.log("");
      const useIt = await promptUser("Save this to .env? [y/n]: ");
      if (useIt === "y" || useIt === "yes" || !useIt) {
        newVars["GIT_REMOTE_URL"] = detectedGit.remoteUrl;
        newVars["GIT_BRANCH"] = detectedGit.branch;
        newVars["GIT_USER_NAME"] = detectedGit.userName;
        newVars["GIT_USER_EMAIL"] = detectedGit.userEmail;
        console.log("Git repo     ... saved");
      } else {
        console.log("Git repo     ... skipped");
      }
    } else {
      console.log("Git repo     ... not detected (not a git repo or no remote)");
    }
  }

  console.log("");

  // Step 4: Vercel
  const hasVercel =
    existing["VERCEL_TOKEN"] &&
    existing["VERCEL_ORG_ID"] &&
    existing["VERCEL_PROJECT_ID"];

  if (hasVercel) {
    console.log("Vercel       ... already configured");
  } else if (!shellOk("which vercel")) {
    console.log("Vercel CLI is not installed.");
    console.log("Sandbox deployment requires Vercel.");
    console.log("");
    const install = await promptUser("Install vercel now? [y/n]: ");
    if (install === "y" || install === "yes") {
      console.log("");
      console.log("Installing vercel...");
      try {
        execSync("npm i -g vercel", { stdio: "inherit" });
        console.log("");
        console.log("Running vercel login...");
        execSync("vercel login", { stdio: "inherit" });
      } catch {
        console.log("Vercel       ... install failed, skipping");
      }
    }

    // Check if it worked (whether we just installed or user said no)
    if (!shellOk("which vercel") || !shellOk("vercel whoami")) {
      console.log("Vercel       ... not configured (sandbox won't work)");
    }
  }

  // Vercel is installed — configure it (runs for both fresh install and existing)
  if (!hasVercel && shellOk("vercel whoami")) {
    // Link project if needed
    const projectJsonPath = join(cwd, ".vercel", "project.json");
    if (!existsSync(projectJsonPath)) {
      console.log("Vercel       ... linking project...");
      execSync("vercel link --yes", { cwd, stdio: "inherit" });
    }

    // Read project IDs
    if (existsSync(projectJsonPath)) {
      const project = JSON.parse(readFileSync(projectJsonPath, "utf-8")) as {
        orgId: string;
        projectId: string;
      };
      if (!existing["VERCEL_ORG_ID"]) {
        newVars["VERCEL_ORG_ID"] = project.orgId;
      }
      if (!existing["VERCEL_PROJECT_ID"]) {
        newVars["VERCEL_PROJECT_ID"] = project.projectId;
      }
    }

    // Read auth token
    if (!existing["VERCEL_TOKEN"]) {
      const authPath = join(getVercelConfigDir(), "auth.json");
      if (existsSync(authPath)) {
        const auth = JSON.parse(readFileSync(authPath, "utf-8")) as {
          token: string;
        };
        newVars["VERCEL_TOKEN"] = auth.token;
      }
    }

    console.log("Vercel       ... configured from CLI");
  } else if (!hasVercel && shellOk("which vercel")) {
    // Installed but not logged in
    console.log("Vercel CLI is installed but not logged in.");
    console.log("Sandbox deployment requires Vercel auth.");
    console.log("");
    const login = await promptUser("Run vercel login now? [y/n]: ");
    if (login === "y" || login === "yes") {
      try {
        execSync("vercel login", { stdio: "inherit" });
      } catch {
        console.log("Vercel       ... login failed");
      }
    }

    if (shellOk("vercel whoami")) {
      // Login succeeded — link and configure
      const projectJsonPath2 = join(cwd, ".vercel", "project.json");
      if (!existsSync(projectJsonPath2)) {
        console.log("Vercel       ... linking project...");
        execSync("vercel link --yes", { cwd, stdio: "inherit" });
      }
      if (existsSync(projectJsonPath2)) {
        const project = JSON.parse(readFileSync(projectJsonPath2, "utf-8")) as {
          orgId: string;
          projectId: string;
        };
        if (!existing["VERCEL_ORG_ID"]) newVars["VERCEL_ORG_ID"] = project.orgId;
        if (!existing["VERCEL_PROJECT_ID"]) newVars["VERCEL_PROJECT_ID"] = project.projectId;
      }
      if (!existing["VERCEL_TOKEN"]) {
        const authPath2 = join(getVercelConfigDir(), "auth.json");
        if (existsSync(authPath2)) {
          const auth = JSON.parse(readFileSync(authPath2, "utf-8")) as { token: string };
          newVars["VERCEL_TOKEN"] = auth.token;
        }
      }
      console.log("Vercel       ... configured");
    } else {
      console.log("Vercel       ... not configured (sandbox won't work)");
    }
  }

  console.log("");

  // Step 4: Write .env
  if (Object.keys(newVars).length > 0) {
    // Split into new keys (to add) and existing keys (to update)
    const toUpdate: Record<string, string> = {};
    const toAdd: Record<string, string> = {};
    for (const [key, val] of Object.entries(newVars)) {
      if (existing[key]) {
        toUpdate[key] = val;
      } else {
        toAdd[key] = val;
      }
    }
    if (Object.keys(toAdd).length > 0) writeEnvVars(cwd, toAdd);
    if (Object.keys(toUpdate).length > 0) updateEnvVars(cwd, toUpdate);

    console.log("Wrote to .env:");
    for (const key of Object.keys(newVars)) {
      const display =
        key.includes("TOKEN") || key.includes("KEY") || key.includes("SECRET")
          ? newVars[key].slice(0, 8) + "..."
          : newVars[key];
      console.log(`  ${key}=${display}`);
    }
  } else {
    console.log("Nothing new to write — .env is already configured.");
  }

  console.log("");
  console.log("Next steps:");
  console.log("  npm run dev          Start the dev server");
  console.log("  npx viagen sandbox   Deploy to a sandbox");
}

// ─── dev command ─────────────────────────────────────────────────

import { spawn as spawnChild } from "node:child_process";

function dev() {
  const child = spawnChild("npx", ["vite"], {
    cwd: process.cwd(),
    stdio: ["inherit", "pipe", "inherit"],
    shell: true,
  });

  let opened = false;

  child.stdout?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    process.stdout.write(text);

    if (!opened) {
      const match = text.match(/Local:\s+(https?:\/\/[^\s]+)/);
      if (match) {
        opened = true;
        const baseUrl = match[1].replace(/\/$/, "");
        const iframeUrl = `${baseUrl}/via/iframe`;
        setTimeout(() => openBrowser(iframeUrl), 500);
      }
    }
  });

  child.on("close", (code) => {
    process.exit(code ?? 0);
  });

  // Forward signals to child
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
}

// ─── sandbox command ─────────────────────────────────────────────

function parseFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return undefined;
}

interface SandboxRunOptions {
  extraEnvVars?: Record<string, string>;
  promptOverride?: string;
}

async function sandbox(args: string[], options?: SandboxRunOptions) {
  const subcommand = args[0];

  if (subcommand === "stop") {
    const sandboxId = args[1];
    if (!sandboxId) {
      console.error("Usage: viagen sandbox stop <sandboxId>");
      process.exit(1);
    }

    console.log(`Stopping sandbox ${sandboxId}...`);
    await stopSandbox(sandboxId);
    console.log("Sandbox stopped.");
    return;
  }

  const branchOverride = parseFlag(args, "--branch") || parseFlag(args, "-b");
  const timeoutFlag = parseFlag(args, "--timeout") || parseFlag(args, "-t");
  const timeoutMinutes = timeoutFlag ? parseInt(timeoutFlag, 10) : undefined;
  const prompt = options?.promptOverride || parseFlag(args, "--prompt") || parseFlag(args, "-p");

  // Default: deploy sandbox
  const cwd = process.cwd();
  const dotenv = loadDotenv(cwd);
  if (options?.extraEnvVars) {
    Object.assign(dotenv, options.extraEnvVars);
  }
  for (const [key, val] of Object.entries(dotenv)) {
    if (!process.env[key]) process.env[key] = val;
  }
  const env = { ...dotenv, ...process.env } as Record<string, string>;

  const hasApiKey = !!env["ANTHROPIC_API_KEY"];
  const hasOAuth = !!env["CLAUDE_ACCESS_TOKEN"];
  if (!hasApiKey && !hasOAuth) {
    console.error(
      "Error: No Claude auth found. Run `npx viagen setup` first.",
    );
    process.exit(1);
  }

  // Refresh OAuth tokens if expired (or expiring within 5 min)
  if (hasOAuth && env["CLAUDE_REFRESH_TOKEN"]) {
    const expires = parseInt(env["CLAUDE_TOKEN_EXPIRES"] || "0", 10);
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec > expires - 300) {
      console.log("Refreshing Claude OAuth tokens...");
      try {
        const tokens = await refreshAccessToken(env["CLAUDE_REFRESH_TOKEN"]);
        env["CLAUDE_ACCESS_TOKEN"] = tokens.access_token;
        env["CLAUDE_REFRESH_TOKEN"] = tokens.refresh_token;
        env["CLAUDE_TOKEN_EXPIRES"] = String(nowSec + tokens.expires_in);
        // Persist refreshed tokens to .env
        updateEnvVars(cwd, {
          CLAUDE_ACCESS_TOKEN: tokens.access_token,
          CLAUDE_REFRESH_TOKEN: tokens.refresh_token,
          CLAUDE_TOKEN_EXPIRES: String(nowSec + tokens.expires_in),
        });
        console.log("  Tokens refreshed.");
      } catch (err) {
        console.error(
          "Failed to refresh OAuth tokens. Run `npx viagen setup` to re-authenticate.",
        );
        console.error(`  ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    }
  }

  const hasOidc = !!env["VERCEL_OIDC_TOKEN"];
  const hasToken =
    !!env["VERCEL_TOKEN"] &&
    !!env["VERCEL_ORG_ID"] &&
    !!env["VERCEL_PROJECT_ID"];

  if (!hasOidc && !hasToken) {
    console.error(
      "Error: Vercel not configured. Run `npx viagen setup` first.",
    );
    process.exit(1);
  }

  // Git detection — prefer .env vars over runtime detection
  const githubToken = env["GITHUB_TOKEN"];
  const envRemoteUrl = env["GIT_REMOTE_URL"];
  const envBranch = env["GIT_BRANCH"];
  const envUserName = env["GIT_USER_NAME"];
  const envUserEmail = env["GIT_USER_EMAIL"];

  // Use .env git info if available, otherwise fall back to runtime detection
  const gitInfo: LocalGitInfo | null = envRemoteUrl
    ? {
        remoteUrl: envRemoteUrl,
        branch: envBranch || "main",
        userName: envUserName || "viagen",
        userEmail: envUserEmail || "noreply@viagen.dev",
        isDirty: false, // can't know from env, assume clean
      }
    : getGitInfo(cwd);

  if (envRemoteUrl) {
    console.log("Using git info from .env");
  }

  let deployGit: GitInfo | undefined;
  let overlayFiles: { path: string; content: Buffer }[] | undefined;

  const branch = branchOverride || (gitInfo ? gitInfo.branch : "main");

  if (gitInfo && githubToken) {
    let branchExistsOnRemote = remoteBranchExists(
      gitInfo.remoteUrl,
      branch,
      githubToken,
    );
    if (!branchExistsOnRemote) {
      console.log(
        `Branch "${branch}" not found on remote — creating it...`,
      );
      const created = createRemoteBranch(
        gitInfo.remoteUrl,
        branch,
        githubToken,
      );
      if (created) {
        console.log(`  Branch "${branch}" created on remote (from main).`);
        branchExistsOnRemote = true;
      } else {
        console.log(
          `  Could not create branch on remote — will clone default branch and create locally.`,
        );
      }
    }

    const makeGitInfo = (): GitInfo => ({
      remoteUrl: gitInfo.remoteUrl,
      branch,
      revision: branchExistsOnRemote ? branch : undefined,
      userName: gitInfo.userName,
      userEmail: gitInfo.userEmail,
      token: githubToken,
    });

    // Only offer dirty-tree options when using runtime detection (not .env)
    if (!envRemoteUrl && gitInfo.isDirty && !branchOverride) {
      console.log("");
      console.log("Your working tree has uncommitted changes.");
      console.log("");
      console.log("  1) Clone from remote (clean) — full git, can push");
      console.log("  2) Upload local files — includes changes, no git");
      console.log(
        "  3) Clone + overlay — git history + your local changes (default)",
      );
      console.log("");
      const answer = await promptUser("Choose mode [1/2/3]: ");
      if (!answer || answer === "3") {
        deployGit = makeGitInfo();
        overlayFiles = collectFiles(cwd, cwd);
      } else if (answer === "1") {
        deployGit = makeGitInfo();
      } else {
        console.log("Note: Sandbox is ephemeral — changes can't be pushed.");
      }
    } else {
      deployGit = makeGitInfo();
    }
  } else if (gitInfo && !githubToken) {
    console.log(
      "Note: No GITHUB_TOKEN set — changes from the sandbox can't be saved.",
    );
  } else {
    console.log(
      "Note: Not a git repo — sandbox will use file upload (ephemeral).",
    );
  }

  // Read sandboxFiles from .viagen/config.json (written by the plugin)
  const configPath = join(cwd, ".viagen", "config.json");
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      const sandboxFiles: string[] = config.sandboxFiles ?? [];
      if (sandboxFiles.length > 0) {
        const extra: { path: string; content: Buffer }[] = [];
        for (const file of sandboxFiles) {
          const fullPath = join(cwd, file);
          if (existsSync(fullPath)) {
            extra.push({ path: file, content: readFileSync(fullPath) });
          } else {
            console.log(`  Warning: sandboxFiles entry "${file}" not found, skipping.`);
          }
        }
        if (extra.length > 0) {
          overlayFiles = [...(overlayFiles ?? []), ...extra];
          console.log(`  Including ${extra.length} extra file(s) from sandboxFiles.`);
        }
      }
    } catch {
      // Ignore if config is missing or malformed
    }
  }

  console.log("");
  if (deployGit) {
    console.log(`  Repo:   ${deployGit.remoteUrl}`);
    console.log(`  Branch: ${deployGit.branch}`);
  }

  // Spinner while sandbox deploys
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let frameIdx = 0;
  const spinner = setInterval(() => {
    process.stdout.write(`\r  ${frames[frameIdx++ % frames.length]} Creating sandbox...`);
  }, 80);

  const result = await deploySandbox({
    cwd,
    apiKey: hasApiKey ? env["ANTHROPIC_API_KEY"] : undefined,
    oauth: hasOAuth
      ? {
          accessToken: env["CLAUDE_ACCESS_TOKEN"],
          refreshToken: env["CLAUDE_REFRESH_TOKEN"],
          tokenExpires: env["CLAUDE_TOKEN_EXPIRES"],
        }
      : undefined,
    git: deployGit,
    overlayFiles,
    envVars: dotenv,
    vercel:
      env["VERCEL_TOKEN"] && env["VERCEL_ORG_ID"] && env["VERCEL_PROJECT_ID"]
        ? {
            token: env["VERCEL_TOKEN"],
            teamId: env["VERCEL_ORG_ID"],
            projectId: env["VERCEL_PROJECT_ID"],
          }
        : undefined,
    fling: existsSync(join(homedir(), ".fling", "token"))
      ? { token: readFileSync(join(homedir(), ".fling", "token"), "utf-8").trim() }
      : undefined,
    timeoutMinutes,
    prompt,
  });

  clearInterval(spinner);
  process.stdout.write("\r  ✓ Sandbox ready!            \n");

  const baseUrl = result.url.replace(/\/t\/.*$/, "");
  const iframeUrl = `${baseUrl}/via/iframe/t/${result.token}`;
  const chatUrl = `${baseUrl}/via/ui/t/${result.token}`;
  const popUrl = `${baseUrl}/via/pop/t/${result.token}`;

  console.log("");
  console.log(`  App:        ${result.url}`);
  console.log(`  App + Chat: ${popUrl}`);
  console.log(`  Split view: ${iframeUrl}`);
  console.log(`  Chat only:  ${chatUrl}`);
  console.log("");
  console.log(`  Sandbox ID: ${result.sandboxId}`);
  console.log(
    `  Mode:       ${result.mode === "git" ? "git clone (can push)" : "file upload (ephemeral)"}`,
  );
  console.log(`  Timeout:    ${timeoutMinutes ?? 30} minutes`);

  openBrowser(iframeUrl);

  // Stream dev server logs and keep process alive
  console.log("");
  console.log("  Streaming sandbox logs (Ctrl+C to stop)...");
  console.log("");

  const ac = new AbortController();
  const cleanup = async () => {
    ac.abort();
    console.log("");
    console.log("Stopping sandbox...");
    await result.stop().catch(() => {});
    console.log("Sandbox stopped.");
    process.exit(0);
  };

  process.on("SIGINT", () => { cleanup(); });
  process.on("SIGTERM", () => { cleanup(); });

  try {
    for await (const log of result.streamLogs({ signal: ac.signal })) {
      if (log.stream === "stderr") {
        process.stderr.write(log.data);
      } else {
        process.stdout.write(log.data);
      }
    }
  } catch {
    // Stream ended (abort or sandbox stopped)
  }
}

// ─── sync helpers ───────────────────────────────────────────────

/** Keys that are local-only and should never be synced to the platform. */
const SYNC_DENY_KEYS = new Set([
  "VIAGEN_ENVIRONMENT_ID",
  "VIAGEN_PLATFORM_URL",
  "INFISICAL_CLIENT_ID",
  "INFISICAL_CLIENT_SECRET",
  "INFISICAL_PROJECT_ID",
]);

/** Gather all env vars to sync as environment secrets (minus local-only keys). */
export function gatherSyncSecrets(
  env: Record<string, string>,
): Record<string, string> {
  const secrets: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value && !SYNC_DENY_KEYS.has(key)) {
      secrets[key] = value;
    }
  }
  return secrets;
}

// ─── sync command ───────────────────────────────────────────────

async function sync() {
  const client = await requireClient();
  const cwd = process.cwd();
  const env = loadDotenv(cwd);

  console.log("viagen sync");
  console.log("");

  // Check for existing environment ID from a previous sync
  let environmentId: string | undefined = env["VIAGEN_ENVIRONMENT_ID"];
  let environmentName: string | undefined;

  if (environmentId) {
    try {
      const existing = await client.environments.get(environmentId);
      environmentName = existing.name;
      console.log(`Environment: ${environmentName}`);
    } catch {
      console.log("Previously synced environment not found. Choose an environment:");
      console.log("");
      environmentId = undefined;
    }
  }

  if (!environmentId) {
    const environments = await client.environments.list();

    if (environments.length > 0) {
      console.log("Your environments:");
      console.log("");
      for (let i = 0; i < environments.length; i++) {
        const repo = environments[i].githubRepo ? ` (${environments[i].githubRepo})` : "";
        console.log(`  ${i + 1}) ${environments[i].name}${repo}`);
      }
      console.log(`  ${environments.length + 1}) Create new environment`);
      console.log("");

      const choice = await promptUser("Choose: ");
      const idx = parseInt(choice, 10) - 1;

      if (idx >= 0 && idx < environments.length) {
        environmentId = environments[idx].id;
        environmentName = environments[idx].name;
      } else {
        environmentName = await promptUser("Environment name: ");
        if (!environmentName) {
          console.log("Cancelled.");
          return;
        }
      }
    } else {
      environmentName = await promptUser("Environment name: ");
      if (!environmentName) {
        console.log("Cancelled.");
        return;
      }
    }
  }

  // Gather secrets from local .env
  const secrets = gatherSyncSecrets(env);

  if (Object.keys(secrets).length === 0) {
    console.error("No credentials found in .env to sync.");
    console.error("Run `viagen setup` first to configure credentials.");
    process.exit(1);
  }

  // Try to refresh Claude tokens if expired — but don't block sync on failure.
  // The platform handles expired token fallback in its own resolution logic.
  if (secrets["CLAUDE_ACCESS_TOKEN"] && env["CLAUDE_REFRESH_TOKEN"]) {
    const expires = parseInt(env["CLAUDE_TOKEN_EXPIRES"] || "0", 10);
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec > expires - 300) {
      try {
        const tokens = await refreshAccessToken(env["CLAUDE_REFRESH_TOKEN"]);
        secrets["CLAUDE_ACCESS_TOKEN"] = tokens.access_token;
        secrets["CLAUDE_REFRESH_TOKEN"] = tokens.refresh_token;
        secrets["CLAUDE_TOKEN_EXPIRES"] = String(nowSec + tokens.expires_in);
        updateEnvVars(cwd, {
          CLAUDE_ACCESS_TOKEN: tokens.access_token,
          CLAUDE_REFRESH_TOKEN: tokens.refresh_token,
          CLAUDE_TOKEN_EXPIRES: String(nowSec + tokens.expires_in),
        });
        console.log("Claude tokens refreshed.");
      } catch {
        console.log("Claude OAuth tokens expired (will sync as-is).");
      }
    }
  }

  // Show summary and confirm
  console.log("");
  console.log(`Secrets to sync (${Object.keys(secrets).length}):`);
  for (const key of Object.keys(secrets)) {
    console.log(`  ${key}`);
  }
  console.log("");

  const answer = await promptUser("Push to platform? [y/n]: ");
  if (answer !== "y" && answer !== "yes") {
    console.log("Cancelled.");
    return;
  }

  // Extract environment metadata from env/git, falling back to runtime detection
  const gitInfo = getGitInfo(cwd);
  const gitRemote = env["GIT_REMOTE_URL"] || gitInfo?.remoteUrl;
  const githubRepo = gitRemote ? repoNwo(gitRemote) : undefined;
  console.log("");
  console.log("Syncing...");

  const vercelProjectId = env["VERCEL_PROJECT_ID"];
  const vercelOrgId = env["VERCEL_ORG_ID"];

  const syncInput = {
    ...(environmentId ? { id: environmentId } : {}),
    name: environmentName!,
    ...(githubRepo ? { githubRepo } : {}),
    ...(vercelProjectId ? { vercelProjectId } : {}),
    ...(vercelOrgId ? { vercelOrgId } : {}),
    secrets,
  };

  let result;
  try {
    result = await client.environments.sync(syncInput);
  } catch (err: unknown) {
    const logDir = join(cwd, ".viagen");
    const logFile = join(logDir, "sync-error.log");
    if (!existsSync(logDir)) {
      const { mkdirSync } = await import("node:fs");
      mkdirSync(logDir, { recursive: true });
    }
    const timestamp = new Date().toISOString();
    const lines = [`[${timestamp}] viagen sync failed`];
    if (err instanceof ViagenApiError) {
      lines.push(`Status: ${err.status}`);
      lines.push(`Message: ${err.message}`);
      if (err.detail) lines.push(`Detail: ${err.detail}`);
    } else {
      lines.push(`Error: ${err instanceof Error ? err.stack || err.message : String(err)}`);
    }
    lines.push(`Input: ${JSON.stringify({ ...syncInput, secrets: Object.keys(syncInput.secrets || {}) })}`);
    writeFileSync(logFile, lines.join("\n") + "\n");
    console.error("Sync failed. A complete log has been written to:");
    console.error(`  ${logFile}`);
    process.exit(1);
  }

  // Save environment ID for future syncs
  if (!env["VIAGEN_ENVIRONMENT_ID"]) {
    writeEnvVars(cwd, { VIAGEN_ENVIRONMENT_ID: result.app.id });
  }

  console.log(
    `Synced "${result.app.name}" — ${result.secrets.stored} secrets stored.`,
  );
  if (result.secrets.failed && result.secrets.failed.length > 0) {
    console.log(`  Failed (${result.secrets.failed.length}): ${result.secrets.failed.join(", ")}`);
  }
  if (result.resolvedKeys) {
    console.log(`  Resolved: ${result.resolvedKeys.length} keys available`);
  }
  console.log("You can now launch sandboxes from the web platform.");
}

// ─── login command ───────────────────────────────────────────────

const PLATFORM_URL = process.env.VIAGEN_PLATFORM_URL || "https://app.viagen.dev";

async function login() {
  // Check if already logged in
  const existing = await loadCredentials();
  if (existing) {
    const client = createViagen({
      baseUrl: existing.baseUrl,
      token: existing.token,
    });
    try {
      const user = await client.auth.me();
      if (user) {
        console.log(`Already logged in as ${user.email}`);
        const answer = await promptUser("Log in again? [y/n]: ");
        if (answer !== "y" && answer !== "yes") return;
      }
    } catch {
      // Token expired or invalid — proceed with login
    }
  }

  console.log("viagen login");
  console.log("");

  const client = createViagen({ baseUrl: PLATFORM_URL });

  console.log("Opening browser to authorize...");
  const { token, expiresAt } = await client.auth.loginCli({
    onOpenUrl: (url: string) => {
      openBrowser(url);
      console.log("");
      console.log("If the browser didn't open, visit:");
      console.log(`  ${url}`);
      console.log("");
      console.log("Waiting for authorization...");
    },
  });

  await saveCredentials({ token, baseUrl: PLATFORM_URL, expiresAt });

  // Verify the token works
  const authed = createViagen({ baseUrl: PLATFORM_URL, token });
  const user = await authed.auth.me();

  console.log("");
  if (user) {
    console.log(`Logged in as ${user.email}`);
  } else {
    console.log("Logged in.");
  }
  console.log("Credentials saved to ~/.config/viagen/credentials.json");
}

// ─── logout command ──────────────────────────────────────────────

async function logout() {
  const existing = await loadCredentials();
  if (!existing) {
    console.log("Not logged in.");
    return;
  }

  await clearCredentials();
  console.log("Logged out. Credentials removed.");
}

// ─── whoami command ──────────────────────────────────────────────

async function whoami() {
  const existing = await loadCredentials();
  if (!existing) {
    console.log("Not logged in. Run `viagen login` to authenticate.");
    return;
  }

  const client = createViagen({
    baseUrl: existing.baseUrl,
    token: existing.token,
  });

  try {
    const user = await client.auth.me();
    if (user) {
      console.log(`${user.email}${user.name ? ` (${user.name})` : ""}`);
      if (user.organizations.length > 0) {
        const teams = user.organizations.map((o: { id: string; name: string }) =>
          o.id === existing.orgId ? `${o.name} (active)` : o.name,
        );
        console.log(`Teams: ${teams.join(", ")}`);
      }
    } else {
      console.log("Session expired. Run `viagen login` to re-authenticate.");
    }
  } catch {
    console.log("Session expired. Run `viagen login` to re-authenticate.");
  }
}

// ─── platform client helper ──────────────────────────────────────

import type { ViagenClient } from "viagen-sdk";

async function requireClient(): Promise<ViagenClient> {
  const creds = await loadCredentials();
  if (!creds) {
    console.error("Not logged in. Run `viagen login` first.");
    process.exit(1);
  }
  return createViagen({ baseUrl: creds.baseUrl, token: creds.token, orgId: creds.orgId });
}

async function requireEnvironmentId(client: ViagenClient): Promise<string> {
  const cwd = process.cwd();
  const env = loadDotenv(cwd);
  let environmentId: string | undefined = env["VIAGEN_ENVIRONMENT_ID"];

  if (environmentId) {
    try {
      await client.environments.get(environmentId);
      return environmentId;
    } catch {
      console.log("Environment from .env not found. Choose an environment:");
      console.log("");
      environmentId = undefined;
    }
  }

  const environments = await client.environments.list();

  if (environments.length === 0) {
    console.error("No environments found. Create one with `viagen environments create <name>` or `viagen sync`.");
    process.exit(1);
  }

  if (environments.length === 1) {
    return environments[0].id;
  }

  console.log("Select an environment:");
  console.log("");
  for (let i = 0; i < environments.length; i++) {
    const repo = environments[i].githubRepo ? ` (${environments[i].githubRepo})` : "";
    console.log(`  ${i + 1}) ${environments[i].name}${repo}`);
  }
  console.log("");

  const choice = await promptUser("Choose: ");
  const idx = parseInt(choice, 10) - 1;

  if (idx < 0 || idx >= environments.length) {
    console.error("Invalid selection.");
    process.exit(1);
  }

  return environments[idx].id;
}

// ─── teams command ──────────────────────────────────────────────

async function teams() {
  const client = await requireClient();
  const memberships = (await client.orgs.list()) ?? [];

  if (memberships.length === 0) {
    console.log("No teams. Create one with `viagen orgs create <name>`.");
    return;
  }

  const creds = (await loadCredentials())!;

  if (memberships.length === 1) {
    console.log(`You're in "${memberships[0].name}" (only team).`);
    return;
  }

  console.log("Your teams:");
  console.log("");
  for (let i = 0; i < memberships.length; i++) {
    const active = memberships[i].id === creds.orgId ? " (active)" : "";
    console.log(`  ${i + 1}) ${memberships[i].name}${active}`);
  }
  console.log("");

  const choice = await promptUser("Switch to: ");
  const idx = parseInt(choice, 10) - 1;

  if (idx < 0 || idx >= memberships.length) {
    console.log("Cancelled.");
    return;
  }

  const selected = memberships[idx];
  await saveCredentials({ ...creds, orgId: selected.id });
  console.log(`Switched to "${selected.name}".`);
}

// ─── orgs command ────────────────────────────────────────────────

async function orgs(args: string[]) {
  const sub = args[0];

  if (sub === "create") {
    const name = args.slice(1).join(" ");
    if (!name) {
      console.error("Usage: viagen orgs create <name>");
      process.exit(1);
    }
    const client = await requireClient();
    const org = await client.orgs.create({ name });
    console.log(`Created org "${org.name}" (${org.id})`);
    return;
  }

  if (sub === "invite") {
    const email = args[1];
    if (!email) {
      console.error("Usage: viagen orgs invite <email>");
      process.exit(1);
    }
    const client = await requireClient();
    await client.orgs.addMember({ email });
    console.log(`Invited ${email}`);
    return;
  }

  // Default: list orgs
  const client = await requireClient();
  const memberships = (await client.orgs.list()) ?? [];

  if (memberships.length === 0) {
    console.log("No organizations. Create one with `viagen orgs create <name>`.");
    return;
  }

  for (const m of memberships) {
    const role = m.role ? ` (${m.role})` : "";
    console.log(`  ${m.name}${role}`);
  }
}

// ─── environments command ────────────────────────────────────────

async function environments(args: string[]) {
  const sub = args[0];

  if (sub === "create") {
    const name = args.slice(1).join(" ");
    if (!name) {
      console.error("Usage: viagen environments create <name>");
      process.exit(1);
    }
    const client = await requireClient();
    const environment = await client.environments.create({ name });
    console.log(`Created environment "${environment.name}" (${environment.id})`);
    return;
  }

  if (sub === "get") {
    const id = args[1];
    if (!id) {
      console.error("Usage: viagen environments get <id>");
      process.exit(1);
    }
    const client = await requireClient();
    const environment = await client.environments.get(id);
    console.log(`  Name:     ${environment.name}`);
    console.log(`  ID:       ${environment.id}`);
    if (environment.githubRepo) console.log(`  GitHub:   ${environment.githubRepo}`);
    if (environment.templateId) console.log(`  Template: ${environment.templateId}`);
    console.log(`  Created:  ${environment.createdAt}`);
    return;
  }

  if (sub === "delete") {
    const id = args[1];
    if (!id) {
      console.error("Usage: viagen environments delete <id>");
      process.exit(1);
    }
    const answer = await promptUser(`Delete environment ${id}? [y/n]: `);
    if (answer !== "y" && answer !== "yes") return;
    const client = await requireClient();
    await client.environments.delete(id);
    console.log("Environment deleted.");
    return;
  }

  // Default: list environments
  const client = await requireClient();
  const list = (await client.environments.list()) ?? [];

  if (list.length === 0) {
    console.log("No environments. Create one with `viagen environments create <name>`.");
    return;
  }

  for (const e of list) {
    const repo = e.githubRepo ? ` (${e.githubRepo})` : "";
    console.log(`  ${e.name}${repo}  ${e.id}`);
  }
}

// ─── tasks command ───────────────────────────────────────────────

function formatTaskStatus(status: string): string {
  const icons: Record<string, string> = {
    ready: "○",
    running: "●",
    completed: "✓",
    failed: "✗",
    validating: "◎",
  };
  return `${icons[status] || "?"} ${status}`;
}

async function tasksList(args: string[]) {
  const client = await requireClient();
  const environmentId = await requireEnvironmentId(client);
  const status = parseFlag(args, "--status") || parseFlag(args, "-s");

  const list = await client.tasks.list(environmentId, status);

  if (list.length === 0) {
    console.log(
      status
        ? `No tasks with status "${status}".`
        : "No tasks. Create one with `viagen tasks create <prompt>`.",
    );
    return;
  }

  console.log(
    `${"ID".padEnd(10)} ${"STATUS".padEnd(14)} ${"BRANCH".padEnd(20)} ${"CREATED".padEnd(12)} PROMPT`,
  );
  console.log("-".repeat(80));

  for (const t of list) {
    const id = t.id.slice(0, 8);
    const st = formatTaskStatus(t.status).padEnd(14);
    const branch = (t.branch || "-").slice(0, 18).padEnd(20);
    const created = t.createdAt.slice(0, 10).padEnd(12);
    const prompt =
      t.prompt.length > 40 ? t.prompt.slice(0, 37) + "..." : t.prompt;
    console.log(`${id.padEnd(10)} ${st} ${branch} ${created} ${prompt}`);
  }

  console.log("");
  console.log(`${list.length} task(s)`);
}

async function tasksCreate(args: string[]) {
  const branch = parseFlag(args, "--branch") || parseFlag(args, "-b");
  const type = parseFlag(args, "--type") || parseFlag(args, "-T");

  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--branch" || args[i] === "-b") {
      i++;
      continue;
    }
    if (args[i] === "--type" || args[i] === "-T") {
      i++;
      continue;
    }
    positional.push(args[i]);
  }

  let prompt = positional.join(" ");

  if (!prompt) {
    prompt = await promptUser("Task prompt: ");
    if (!prompt) {
      console.log("Cancelled.");
      return;
    }
  }

  const client = await requireClient();
  const environmentId = await requireEnvironmentId(client);

  const input: { prompt: string; branch?: string; type?: string } = { prompt };
  if (branch) input.branch = branch;
  if (type) input.type = type;

  const task = await client.tasks.create(environmentId, input);

  console.log(`Task created: ${task.id}`);
  console.log(`  Prompt: ${task.prompt}`);
  console.log(`  Type:   ${task.type}`);
  console.log(`  Branch: ${task.branch}`);
  console.log(`  Status: ${task.status}`);
  console.log("");
  console.log(`Run with: viagen tasks run ${task.id}`);
}

async function tasksGet(args: string[]) {
  const taskId = args[0];
  if (!taskId) {
    console.error("Usage: viagen tasks get <id>");
    process.exit(1);
  }

  const client = await requireClient();
  const environmentId = await requireEnvironmentId(client);
  const task = await client.tasks.get(environmentId, taskId);

  console.log(`  ID:         ${task.id}`);
  console.log(`  Type:       ${task.type}`);
  console.log(`  Status:     ${formatTaskStatus(task.status)}`);
  console.log(`  Prompt:     ${task.prompt}`);
  console.log(`  Branch:     ${task.branch}`);
  console.log(`  Model:      ${task.model}`);
  console.log(`  Created:    ${task.createdAt}`);
  console.log(`  Created By: ${task.createdBy}`);
  if (task.startedAt) console.log(`  Started:    ${task.startedAt}`);
  if (task.completedAt) console.log(`  Completed:  ${task.completedAt}`);
  if (task.durationMs) {
    const secs = (task.durationMs / 1000).toFixed(1);
    console.log(`  Duration:   ${secs}s`);
  }
  if (task.inputTokens || task.outputTokens) {
    console.log(
      `  Tokens:     ${(task.inputTokens || 0).toLocaleString()} in / ${(task.outputTokens || 0).toLocaleString()} out`,
    );
  }
  if (task.prUrl) console.log(`  PR:         ${task.prUrl}`);
  if (task.result) console.log(`  Result:     ${task.result}`);
  if (task.error) console.log(`  Error:      ${task.error}`);
}

async function tasksRun(args: string[]) {
  const taskId = args[0];
  if (!taskId) {
    console.error("Usage: viagen tasks run <id>");
    process.exit(1);
  }

  const client = await requireClient();
  const environmentId = await requireEnvironmentId(client);
  const task = await client.tasks.get(environmentId, taskId);

  console.log(`Running task: ${task.id}`);
  console.log(`  Prompt: ${task.prompt}`);
  console.log(`  Branch: ${task.branch}`);
  console.log("");

  await client.tasks.update(environmentId, taskId, { status: "running" });

  const sandboxArgs: string[] = [];
  if (task.branch) {
    sandboxArgs.push("--branch", task.branch);
  }

  const timeout = parseFlag(args, "--timeout") || parseFlag(args, "-t");
  if (timeout) {
    sandboxArgs.push("--timeout", timeout);
  }

  try {
    await sandbox(sandboxArgs, {
      promptOverride: task.prompt,
      extraEnvVars: {
        VIAGEN_TASK_ID: task.id,
        VIAGEN_ENVIRONMENT_ID: environmentId,
      },
    });
  } catch (err) {
    console.error(`Sandbox deploy failed: ${err instanceof Error ? err.message : String(err)}`);
    await client.tasks.update(environmentId, taskId, { status: "ready" }).catch(() => {});
    process.exit(1);
  }
}

async function tasks(args: string[]) {
  const sub = args[0];

  if (sub === "create") {
    await tasksCreate(args.slice(1));
    return;
  }

  if (sub === "get") {
    await tasksGet(args.slice(1));
    return;
  }

  if (sub === "run") {
    await tasksRun(args.slice(1));
    return;
  }

  // Default: list tasks
  await tasksList(args);
}

// ─── help ────────────────────────────────────────────────────────

function help() {
  console.log("viagen — Claude Code in your Vite dev server");
  console.log("");
  console.log("Usage:");
  console.log("  viagen <command>");
  console.log("");
  console.log("Commands:");
  console.log("  login                          Log in to the viagen platform");
  console.log("  logout                         Log out and remove credentials");
  console.log("  whoami                         Show current user");
  console.log("  teams                          Switch active team");
  console.log("  orgs                           List your organizations");
  console.log("  orgs create <name>             Create a new organization");
  console.log("  orgs invite <email>            Invite a member to the org");
  console.log("  environments                   List environments in current org");
  console.log("  environments create <name>     Create a new environment");
  console.log("  environments get <id>          Show environment details");
  console.log("  environments delete <id>       Delete an environment");
  console.log("  tasks                          List tasks for current environment");
  console.log("  tasks create <prompt>          Create a new task");
  console.log("  tasks get <id>                 Show task details");
  console.log("  tasks run <id>                 Run a task in a sandbox");
  console.log("  dev                            Start Vite and open the split view");
  console.log("  setup                          Set up .env with API keys and tokens");
  console.log("  sandbox [-b branch] [-t min]   Deploy your project to a Vercel Sandbox");
  console.log("  sandbox stop <id>              Stop a running sandbox");
  console.log("  sync                           Push local credentials to the platform");
  console.log("  help                           Show this help message");
  console.log("");
  console.log("Sandbox options:");
  console.log("  -b, --branch <name>   Branch to clone (default: current branch)");
  console.log("  -t, --timeout <min>   Sandbox timeout in minutes (default: 30)");
  console.log("");
  console.log("Task options:");
  console.log("  -s, --status <status>   Filter tasks by status (list)");
  console.log("  -b, --branch <name>     Branch for the task (create)");
  console.log("  -T, --type <type>       Task type: task or plan (create)");
  console.log("");
  console.log("Getting started:");
  console.log("  1. npm install viagen");
  console.log("  2. Add viagen() to your vite.config.ts plugins");
  console.log("  3. npx viagen setup");
  console.log("  4. npm run dev");
  console.log("");
  console.log("Environment variables (.env):");
  console.log(
    "  ANTHROPIC_API_KEY      Claude API key (from console or setup).",
  );
  console.log(
    "  CLAUDE_ACCESS_TOKEN    Claude Max/Pro OAuth token (from setup).",
  );
  console.log(
    "  GITHUB_TOKEN           Enables git commit+push from sandbox.",
  );
  console.log(
    "  GIT_REMOTE_URL         Git remote (from setup, overrides runtime detection).",
  );
  console.log(
    "  GIT_BRANCH             Git branch for sandbox.",
  );
  console.log(
    "  GIT_USER_NAME          Git user name for sandbox commits.",
  );
  console.log(
    "  GIT_USER_EMAIL         Git user email for sandbox commits.",
  );
  console.log(
    "  VIAGEN_AUTH_TOKEN      Protects all endpoints with token auth.",
  );
  console.log(
    "  VIAGEN_MODEL           Override Claude model (e.g. sonnet, opus, haiku).",
  );
  console.log(
    "  VERCEL_TOKEN           Vercel access token (for sandbox).",
  );
  console.log(
    "  VERCEL_ORG_ID          Vercel org/team ID (for sandbox).",
  );
  console.log(
    "  VERCEL_PROJECT_ID      Vercel project ID (for sandbox).",
  );
  console.log("");
  console.log("Docs: https://viagen.dev");
}

// ─── main ────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "login") {
    await login();
  } else if (command === "logout") {
    await logout();
  } else if (command === "whoami") {
    await whoami();
  } else if (command === "teams") {
    await teams();
  } else if (command === "orgs") {
    await orgs(args.slice(1));
  } else if (command === "environments") {
    await environments(args.slice(1));
  } else if (command === "tasks") {
    await tasks(args.slice(1));
  } else if (command === "dev") {
    dev();
    return;
  } else if (command === "setup") {
    await setup();
  } else if (command === "sandbox") {
    await sandbox(args.slice(1));
  } else if (command === "sync") {
    await sync();
  } else {
    help();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
