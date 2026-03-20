import { getSecret } from "~/lib/infisical.server";
import { log } from "~/lib/logger.server";

/**
 * Auto-generate a short session name from a branch name (and optional context)
 * using Claude Haiku. Returns null if unavailable or on failure.
 */
export async function generateSessionName(
  orgId: string,
  branch: string,
  context?: string,
): Promise<string | null> {
  try {
    const apiKey = await getSecret(orgId, "ANTHROPIC_API_KEY");
    if (!apiKey) {
      log.debug({ orgId }, "session name generation: no API key available");
      return null;
    }

    const input = context
      ? `Branch: ${branch}\nContext: ${context.slice(0, 300)}`
      : `Branch: ${branch}`;

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
          "You are a session-naming assistant. Given a git branch name and optional context, respond with ONLY a short human-readable title for this dev session (4 words or fewer, no punctuation, no quotes, title case). Nothing else.",
        messages: [{ role: "user", content: input }],
      }),
    });

    if (!res.ok) {
      log.warn(
        { orgId, status: res.status },
        "session name generation: API request failed",
      );
      return null;
    }

    const data = await res.json();
    const raw: string = data?.content?.[0]?.text ?? "";
    const name = raw.trim().replace(/^["']|["']$/g, "").trim();
    if (!name) return null;
    return name.slice(0, 255);
  } catch (err) {
    log.warn(
      {
        orgId,
        err: err instanceof Error ? err.message : "unknown",
      },
      "session name generation: unexpected error (non-fatal)",
    );
    return null;
  }
}
