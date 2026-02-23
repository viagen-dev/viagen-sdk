import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveAllSecrets } from "~/lib/infisical.server";
import { log } from "~/lib/logger.server";

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

  // Single call to resolve all secrets at both project and org level
  const resolved = await resolveAllSecrets(org.id, id);

  const projectKeys = new Set(resolved.project.map((s) => s.key));
  const orgKeys = new Set(resolved.org.map((s) => s.key));

  // Helper: check if a key exists and where it comes from (project wins)
  const check = (
    key: string,
  ): { available: boolean; source: "project" | "org" | null } => {
    if (projectKeys.has(key)) return { available: true, source: "project" };
    if (orgKeys.has(key)) return { available: true, source: "org" };
    return { available: false, source: null };
  };

  // Helper: get a secret value (project > org)
  const getValue = (key: string): string | null => {
    const p = resolved.project.find((s) => s.key === key);
    if (p) return p.value;
    const o = resolved.org.find((s) => s.key === key);
    if (o) return o.value;
    return null;
  };

  // GitHub
  const githubLinked = !!project.githubRepo;
  const github = check("GITHUB_TOKEN");

  // Vercel
  const vercelLinked = !!project.vercelProjectId;
  const vercel = check("VERCEL_TOKEN");

  // Claude: check for OAuth token first, then API key.
  // If OAuth token is expired, skip it so API key wins.
  let claudeConnected = false;
  let claudeSource: string | null = null;
  let claudeKeyPrefix: string | null = null;
  let claudeExpired = false;

  const oauthCheck = check("CLAUDE_ACCESS_TOKEN");
  const apiKeyCheck = check("ANTHROPIC_API_KEY");

  if (oauthCheck.available) {
    const expires = getValue("CLAUDE_TOKEN_EXPIRES");
    const isExpired =
      expires !== null && !isNaN(Number(expires)) && Number(expires) < Date.now();

    if (!isExpired) {
      claudeConnected = true;
      claudeSource = oauthCheck.source;
      claudeKeyPrefix =
        (getValue("CLAUDE_ACCESS_TOKEN") ?? "").slice(0, 12) + "...";
    } else if (apiKeyCheck.available) {
      // OAuth expired but API key exists — use that
      claudeConnected = true;
      claudeSource = apiKeyCheck.source;
      claudeKeyPrefix =
        (getValue("ANTHROPIC_API_KEY") ?? "").slice(0, 12) + "...";
    } else {
      // OAuth expired, no API key fallback
      claudeConnected = true;
      claudeSource = oauthCheck.source;
      claudeKeyPrefix =
        (getValue("CLAUDE_ACCESS_TOKEN") ?? "").slice(0, 12) + "...";
      claudeExpired = true;
    }
  } else if (apiKeyCheck.available) {
    claudeConnected = true;
    claudeSource = apiKeyCheck.source;
    claudeKeyPrefix =
      (getValue("ANTHROPIC_API_KEY") ?? "").slice(0, 12) + "...";
  }

  // Ready = can launch a sandbox. GitHub repo + token and Claude are hard requirements.
  // Vercel linkage is optional — enhances deployment but doesn't block sandbox launch.
  const ready =
    githubLinked && github.available && claudeConnected && !claudeExpired;

  log.info(
    {
      projectId: id,
      orgId: org.id,
      ready,
      github: { linked: githubLinked, ...github },
      vercel: { linked: vercelLinked, ...vercel },
      claude: {
        connected: claudeConnected,
        source: claudeSource,
        expired: claudeExpired,
      },
    },
    "project status",
  );

  return Response.json({
    ready,
    github: {
      linked: githubLinked,
      tokenAvailable: github.available,
      tokenSource: github.source,
    },
    vercel: {
      linked: vercelLinked,
      tokenAvailable: vercel.available,
      tokenSource: vercel.source,
    },
    claude: {
      connected: claudeConnected,
      source: claudeSource,
      keyPrefix: claudeKeyPrefix,
      expired: claudeExpired,
    },
  });
}
