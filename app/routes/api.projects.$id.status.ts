import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getProjectSecret, getSecret } from "~/lib/infisical.server";
import { log } from "~/lib/logger.server";

const CLAUDE_KEYS = ["CLAUDE_ACCESS_TOKEN", "ANTHROPIC_API_KEY"];

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const { org } = await requireAuth(request);
  const id = params.id;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, org.id)));

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  // Helper: check if a secret exists at project or org level
  const hasToken = async (key: string): Promise<boolean> => {
    const projectVal = await getProjectSecret(org.id, id, key).catch(
      () => null,
    );
    if (projectVal) return true;
    const orgVal = await getSecret(org.id, key).catch(() => null);
    return !!orgVal;
  };

  // GitHub: linked (has repo in DB) + token available
  const githubLinked = !!project.githubRepo;
  const githubToken = await hasToken("GITHUB_TOKEN");

  // Vercel: linked (has vercelProjectId in DB) + token available
  const vercelLinked = !!project.vercelProjectId;
  const vercelToken = await hasToken("VERCEL_TOKEN");

  // Claude: check project > org cascade, plus expiration.
  // If a higher-priority OAuth token is expired, fall through to lower
  // scope so a valid org-level API key can still mark us as ready.

  const isOAuthExpired = async (
    source: "project" | "org",
  ): Promise<boolean> => {
    const expires =
      source === "project"
        ? await getProjectSecret(org.id, id, "CLAUDE_TOKEN_EXPIRES").catch(
            () => null,
          )
        : await getSecret(org.id, "CLAUDE_TOKEN_EXPIRES").catch(() => null);
    if (!expires) return false;
    const expiresMs = Number(expires);
    return !isNaN(expiresMs) && expiresMs < Date.now();
  };

  // Build ordered list of candidates: project > org
  const candidates: { source: string; key: string; val: string }[] = [];

  for (const key of CLAUDE_KEYS) {
    const val = await getProjectSecret(org.id, id, key).catch(() => null);
    if (val) candidates.push({ source: "project", key, val });
  }
  for (const key of CLAUDE_KEYS) {
    const val = await getSecret(org.id, key).catch(() => null);
    if (val) candidates.push({ source: "org", key, val });
  }

  let claudeConnected = false;
  let claudeSource: string | null = null;
  let claudeKeyPrefix: string | null = null;
  let claudeExpired = false;

  for (const c of candidates) {
    // OAuth tokens (CLAUDE_ACCESS_TOKEN) at project/org level can expire —
    // if expired, skip to the next candidate so an org API key wins.
    if (
      c.key === "CLAUDE_ACCESS_TOKEN" &&
      (c.source === "project" || c.source === "org")
    ) {
      const expired = await isOAuthExpired(c.source as "project" | "org");
      if (expired) {
        log.info(
          { projectId: id, source: c.source },
          "status: skipping expired OAuth token, checking next scope",
        );
        continue;
      }
    }

    claudeConnected = true;
    claudeSource = c.source;
    claudeKeyPrefix = c.val.slice(0, 12) + "...";
    break;
  }

  // If we exhausted all candidates without finding a valid one but there
  // WERE expired tokens, still report connected + expired so the UI can
  // show "expired" rather than "not connected".
  if (!claudeConnected && candidates.length > 0) {
    const first = candidates[0];
    claudeConnected = true;
    claudeSource = first.source;
    claudeKeyPrefix = first.val.slice(0, 12) + "...";
    claudeExpired = true;
  }

  log.info(
    {
      projectId: id,
      claudeConnected,
      claudeSource,
      claudeExpired,
      candidateCount: candidates.length,
    },
    "status: claude credential resolution",
  );

  // Ready = can launch a sandbox. GitHub repo + token and Claude are hard requirements.
  // Vercel linkage is optional — enhances deployment but doesn't block sandbox launch.
  const ready =
    githubLinked && githubToken && claudeConnected && !claudeExpired;

  return Response.json({
    ready,
    github: { linked: githubLinked, tokenAvailable: githubToken },
    vercel: { linked: vercelLinked, tokenAvailable: vercelToken },
    claude: {
      connected: claudeConnected,
      source: claudeSource,
      keyPrefix: claudeKeyPrefix,
      expired: claudeExpired,
    },
  });
}
