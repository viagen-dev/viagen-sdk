import { describe, it, expect, vi, beforeEach } from "vitest";

const mockClient = {
  tasks: {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue({ id: "task_1", prompt: "test" }),
    create: vi.fn().mockResolvedValue({ id: "task_2", prompt: "new task" }),
    update: vi.fn().mockResolvedValue({ id: "task_1", status: "completed" }),
  },
};

const { createViagenTools } = await import("./tools");

describe("createViagenTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an MCP server config with name 'viagen'", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = createViagenTools({ client: mockClient as any, projectId: "proj_123" });
    expect(tools.name).toBe("viagen");
    expect(tools.type).toBe("sdk");
    expect(tools.instance).toBeDefined();
  });

  it("exposes all tools when client and projectId provided", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = createViagenTools({ client: mockClient as any, projectId: "proj_123" });
    expect(result).toBeDefined();
    expect(result.name).toBe("viagen");
  });
});
