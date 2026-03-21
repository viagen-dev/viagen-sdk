import { describe, it, expect } from "vitest";
import {
  planModeCanUseTool,
  PLAN_MODE_DISALLOWED_TOOLS,
  PLAN_SYSTEM_PROMPT,
} from "./tools";

describe("plan mode — disallowed tools", () => {
  it("disallows Edit and NotebookEdit", () => {
    expect(PLAN_MODE_DISALLOWED_TOOLS).toContain("Edit");
    expect(PLAN_MODE_DISALLOWED_TOOLS).toContain("NotebookEdit");
  });

  it("does not disallow Read, Glob, Grep, or Write", () => {
    expect(PLAN_MODE_DISALLOWED_TOOLS).not.toContain("Read");
    expect(PLAN_MODE_DISALLOWED_TOOLS).not.toContain("Glob");
    expect(PLAN_MODE_DISALLOWED_TOOLS).not.toContain("Grep");
    expect(PLAN_MODE_DISALLOWED_TOOLS).not.toContain("Write");
  });
});

describe("planModeCanUseTool", () => {
  const dummyOpts = {
    signal: new AbortController().signal,
    toolUseID: "test-123",
  };

  it("allows Write to plans/ directory (relative path)", async () => {
    const result = await planModeCanUseTool(
      "Write",
      { file_path: "plans/auth-system.md" },
      dummyOpts,
    );
    expect(result.behavior).toBe("allow");
  });

  it("allows Write to plans/ directory (absolute path)", async () => {
    const result = await planModeCanUseTool(
      "Write",
      { file_path: "/home/user/project/plans/auth-system.md" },
      dummyOpts,
    );
    expect(result.behavior).toBe("allow");
  });

  it("denies Write to src/ directory", async () => {
    const result = await planModeCanUseTool(
      "Write",
      { file_path: "src/index.ts" },
      dummyOpts,
    );
    expect(result.behavior).toBe("deny");
    if (result.behavior === "deny") {
      expect(result.message).toContain("plans/");
    }
  });

  it("denies Write to root files", async () => {
    const result = await planModeCanUseTool(
      "Write",
      { file_path: "package.json" },
      dummyOpts,
    );
    expect(result.behavior).toBe("deny");
  });

  it("allows Read tool", async () => {
    const result = await planModeCanUseTool(
      "Read",
      { file_path: "src/index.ts" },
      dummyOpts,
    );
    expect(result.behavior).toBe("allow");
  });

  it("allows Glob tool", async () => {
    const result = await planModeCanUseTool(
      "Glob",
      { pattern: "**/*.ts" },
      dummyOpts,
    );
    expect(result.behavior).toBe("allow");
  });

  it("allows Grep tool", async () => {
    const result = await planModeCanUseTool(
      "Grep",
      { pattern: "function", path: "src/" },
      dummyOpts,
    );
    expect(result.behavior).toBe("allow");
  });

  it("allows Bash tool", async () => {
    const result = await planModeCanUseTool(
      "Bash",
      { command: "git status" },
      dummyOpts,
    );
    expect(result.behavior).toBe("allow");
  });

  it("handles missing file_path gracefully", async () => {
    const result = await planModeCanUseTool("Write", {}, dummyOpts);
    expect(result.behavior).toBe("deny");
  });
});

describe("PLAN_SYSTEM_PROMPT", () => {
  it("contains plan mode instructions", () => {
    expect(PLAN_SYSTEM_PROMPT).toContain("PLAN mode");
    expect(PLAN_SYSTEM_PROMPT).toContain("plans/");
    expect(PLAN_SYSTEM_PROMPT).toContain("viagen_update_task");
  });

  it("instructs not to modify existing files", () => {
    expect(PLAN_SYSTEM_PROMPT).toContain("NOT");
  });
});
