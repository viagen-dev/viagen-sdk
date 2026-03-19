import { getSecret } from "~/lib/infisical.server";
import { log } from "~/lib/logger.server";

/**
 * Auto-generate a short task title from a prompt using Claude Haiku.
 * Returns null if the API key is unavailable or the call fails — callers
 * should treat null as "no title" and continue without one.
 */
export async function generateTaskTitle(
  orgId: string,
  prompt: string,
): Promise<string | null> {
  try {
    const apiKey = await getSecret(orgId, "ANTHROPIC_API_KEY");
    if (!apiKey) return null;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 30,
        system:
          "You are a task-naming assistant. Given a task description, respond with ONLY a short, descriptive title (5 words or fewer, no punctuation, no quotes). Nothing else.",
        messages: [
          {
            role: "user",
            content: prompt.slice(0, 500),
          },
        ],
      }),
    });

    if (!res.ok) {
      log.warn(
        { orgId, status: res.status },
        "task title generation: API request failed",
      );
      return null;
    }

    const data = await res.json();
    const raw: string = data?.content?.[0]?.text ?? "";
    const title = raw.trim().replace(/^["']|["']$/g, "").trim();

    if (!title) return null;

    // Hard cap at 255 chars to match the DB column length
    return title.slice(0, 255);
  } catch (err) {
    log.warn(
      { orgId, err: err instanceof Error ? err.message : "unknown" },
      "task title generation: unexpected error (non-fatal)",
    );
    return null;
  }
}
