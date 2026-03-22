import { z } from "zod/v4";
import { debug } from "./debug";
import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
  type CanUseTool,
} from "@anthropic-ai/claude-agent-sdk";
import type { ViagenClient } from "viagen-sdk";
import type { ProcessManager } from "./process-manager";

export interface ViagenToolsConfig {
  client: ViagenClient;
  projectId: string;
  processManager?: ProcessManager;
}

/**
 * Creates an in-process MCP tool server that exposes platform task tools.
 * Uses the ViagenClient SDK to communicate directly with the platform API.
 */
export function createViagenTools(
  config: ViagenToolsConfig,
): McpSdkServerConfigWithInstance {
  const { client, projectId, processManager } = config;
  const taskId = process.env["VIAGEN_TASK_ID"];

  debug("tools", `MCP tools created (projectId: ${projectId}, taskId: ${taskId || "none"})`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: any[] = [
    tool(
      "viagen_update_task",
      "Update a task's status on the viagen platform. Use status 'review' after creating a PR (ready for human review) or 'completed' when the task is fully done. If no taskId is provided, updates the current task (requires VIAGEN_TASK_ID env var).",
      {
        taskId: z
          .string()
          .optional()
          .describe("Task ID to update. Defaults to the current task from VIAGEN_TASK_ID env var."),
        status: z
          .string()
          .optional()
          .describe("Task status to set (e.g. 'review', 'completed'). Omit to update other fields without changing status."),
        prUrl: z
          .string()
          .optional()
          .describe("Full URL of the pull request, if one was created."),
        result: z
          .string()
          .describe("Brief one-line summary of what was done."),
        inputTokens: z.number().optional().describe("Total input tokens used."),
        outputTokens: z
          .number()
          .optional()
          .describe("Total output tokens used."),
        costUsd: z
          .number()
          .optional()
          .describe("Total cost in USD."),
        prReviewStatus: z
          .string()
          .optional()
          .describe("PR review outcome — e.g. 'pass', 'flag', or 'fail'."),
      },
      async (args) => {
        debug("tools", `viagen_update_task called (taskId: ${args.taskId || taskId || "none"}, status: ${args.status || "none"}, projectId: ${projectId})`);
        const id = args.taskId || taskId;
        if (!id) {
          return {
            content: [{ type: "text" as const, text: "Error: No taskId provided and VIAGEN_TASK_ID is not set." }],
          };
        }
        const internalStatus = args.status === "review" ? "validating" : args.status === "completed" ? "completed" : args.status;
        try {
          await client.tasks.update(projectId, id, {
            ...(internalStatus && { status: internalStatus }),
            ...(args.prUrl && { prUrl: args.prUrl }),
            result: args.result,
            ...(args.inputTokens != null && { inputTokens: args.inputTokens }),
            ...(args.outputTokens != null && { outputTokens: args.outputTokens }),
            ...(args.prReviewStatus && { prReviewStatus: args.prReviewStatus }),
          });
          return {
            content: [{ type: "text" as const, text: `Task ${id} updated.${args.status ? ` Status: '${args.status}'.` : ""}${args.prReviewStatus ? ` PR review: '${args.prReviewStatus}'.` : ""}` }],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          const status = (err as any)?.status;
          const detail = (err as any)?.detail;
          debug("tools", `viagen_update_task FAILED: ${status || "?"} ${message}${detail ? ` (${detail})` : ""}`);
          return {
            content: [{ type: "text" as const, text: `Error updating task: ${message}` }],
          };
        }
      },
    ),

    tool(
      "viagen_list_tasks",
      "List tasks in the current project. Optionally filter by status.",
      {
        status: z
          .enum(["ready", "running", "validating", "completed", "timed_out"])
          .optional()
          .describe("Filter tasks by status."),
      },
      async (args) => {
        debug("tools", `viagen_list_tasks called (projectId: ${projectId}, status: ${args.status || "all"})`);
        try {
          const tasks = await client.tasks.list(projectId, args.status);
          debug("tools", `viagen_list_tasks returned ${tasks.length} tasks`);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(tasks, null, 2),
              },
            ],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          debug("tools", `viagen_list_tasks FAILED: ${message}`);
          return {
            content: [{ type: "text" as const, text: `Error listing tasks: ${message}` }],
          };
        }
      },
    ),

    tool(
      "viagen_get_task",
      "Get full details of a specific task by ID.",
      {
        taskId: z.string().describe("The task ID to retrieve."),
      },
      async (args) => {
        debug("tools", `viagen_get_task called (projectId: ${projectId}, taskId: ${args.taskId})`);
        try {
          const task = await client.tasks.get(projectId, args.taskId);
          debug("tools", `viagen_get_task success (status: ${task.status})`);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(task, null, 2),
              },
            ],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          const status = (err as any)?.status;
          debug("tools", `viagen_get_task FAILED: ${status || "?"} ${message}`);
          return {
            content: [{ type: "text" as const, text: `Error getting task: ${message}` }],
          };
        }
      },
    ),

    tool(
      "viagen_create_task",
      "Create a new task in the current project. Use this to create follow-up work.",
      {
        prompt: z
          .string()
          .describe("The task prompt / instructions."),
        branch: z
          .string()
          .optional()
          .describe("Git branch name for the task."),
        type: z
          .enum(["task", "plan"])
          .optional()
          .describe("Task type: 'task' for code changes, 'plan' for implementation plans."),
      },
      async (args) => {
        debug("tools", `viagen_create_task called (projectId: ${projectId}, type: ${args.type || "task"}, prompt: "${args.prompt.slice(0, 80)}...")`);
        try {
          const task = await client.tasks.create(projectId, {
            prompt: args.prompt,
            branch: args.branch,
            type: args.type,
          });
          debug("tools", `viagen_create_task success (taskId: ${task.id})`);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(task, null, 2),
              },
            ],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          const status = (err as any)?.status;
          const detail = (err as any)?.detail;
          debug("tools", `viagen_create_task FAILED: ${status || "?"} ${message}${detail ? ` (${detail})` : ""}`);
          return {
            content: [{ type: "text" as const, text: `Error creating task: ${message}` }],
          };
        }
      },
    ),
  ];

  // Add restart tool if process manager is available (sandbox mode with separate preview)
  if (processManager) {
    tools.push(
      tool(
        "viagen_restart_preview",
        "Restart the preview server. Use after installing packages, changing configs, or when the preview is broken. Optionally provide a new command to run.",
        {
          command: z
            .string()
            .optional()
            .describe("New command to use for the preview server (e.g. 'npm run build && npm run start'). If omitted, restarts with the current command."),
        },
        async (args) => {
          try {
            const result = await processManager.restart(args.command);
            return {
              content: [{ type: "text" as const, text: result }],
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            return {
              content: [{ type: "text" as const, text: `Error restarting preview: ${message}` }],
            };
          }
        },
      ),
    );
  }

  return createSdkMcpServer({ name: "viagen", tools });
}

/**
 * Plan mode tool restrictions.
 * Blocks Edit/NotebookEdit via disallowedTools; restricts Write to plans/ only.
 */
export const PLAN_MODE_DISALLOWED_TOOLS = ["Edit", "NotebookEdit"];

export const planModeCanUseTool: CanUseTool = async (toolName, input) => {
  if (toolName === "Write") {
    const filePath = (input as { file_path?: string }).file_path ?? "";
    if (!filePath.includes("/plans/") && !filePath.startsWith("plans/")) {
      return {
        behavior: "deny" as const,
        message:
          "In plan mode, you can only write files inside the plans/ directory.",
      };
    }
  }
  return { behavior: "allow" as const };
};

/**
 * System prompt for plan-mode tasks.
 */
export const PLAN_SYSTEM_PROMPT = `
You are running in PLAN mode. Your job is to explore the codebase and produce a detailed implementation plan — you must NOT modify any existing code.

Steps:
1. Use Read, Glob, and Grep to explore the codebase and understand the relevant architecture.
2. Write your plan as a markdown file to plans/<slug>.md (create the plans/ directory if needed). The slug should be a short kebab-case name derived from the task prompt.
3. Commit the plan file, push the branch, and create a pull request using the GitHub REST API (GITHUB_TOKEN is available in your environment).
4. Report back using the viagen_update_task tool with status "review" and include the PR URL.

Constraints:
- Do NOT edit, delete, or overwrite any existing files.
- Only create new files inside the plans/ directory.
- Your plan should include: context, proposed changes (with file paths and descriptions), implementation order, and potential risks.
`;

/**
 * System prompt addition for task-aware sandbox sessions.
 * Builds a context-rich prompt so the agent knows it's connected to viagen.
 */
export function buildTaskToolsPrompt(opts: {
  projectId: string;
  taskId?: string;
  branch?: string;
  hasProcessManager?: boolean;
}): string {
  const parts: string[] = [];

  parts.push(`
## Viagen Platform

You are connected to the viagen development platform. This session is part of a viagen project (ID: ${opts.projectId}).${opts.taskId ? ` You are currently working on task ${opts.taskId}.` : ""}${opts.branch ? ` Current branch: ${opts.branch}.` : ""}

When users ask about the project, tasks, work history, or anything related to the viagen platform — **always use your viagen MCP tools** to answer. Do NOT try to grep the codebase or guess — the platform is your source of truth for project and task information.

### Available viagen tools

- **viagen_list_tasks** — List tasks in this project. Filter by status: ready, running, validating, completed, timed_out. Call this when users ask "what tasks are there?", "what's been done?", "what's pending?", etc.
- **viagen_get_task** — Get full details of a specific task including its prompt, status, branch, PR URL, and results.
- **viagen_create_task** — Create a new task. Use when you identify follow-up work or when the user asks you to create a task.
- **viagen_update_task** — Update a task's status. Use 'review' after creating a PR, 'completed' when fully done. Defaults to the current task if one is set.`);

  if (opts.hasProcessManager) {
    parts.push(`
- **viagen_restart_preview** — Restart the app preview server. Use after installing packages, changing configs, or when the preview is broken.`);
  }

  parts.push(`

### How to respond to platform questions

- "What tasks are there?" → call viagen_list_tasks, summarize the results conversationally
- "What's the status of task X?" → call viagen_get_task with the ID
- "What work has been done?" → call viagen_list_tasks with status "completed" or "validating"
- "What's pending?" → call viagen_list_tasks with status "ready"
- "Tell me about this project" → call viagen_list_tasks (no filter) to give an overview of all work

Always present the results in a friendly, conversational way — not raw JSON.`);

  return parts.join("");
}

// Keep the old export name for backwards compat during transition
export const TASK_TOOLS_PROMPT = buildTaskToolsPrompt({ projectId: "unknown" });
