import { requireAuth, isAdminRole } from "~/lib/session.server";
import { getSecret, setSecret, deleteSecret } from "~/lib/infisical.server";
import { log } from "~/lib/logger.server";

const KEY = "ANTHROPIC_API_KEY";

export async function loader({ request }: { request: Request }) {
  const { org } = await requireAuth(request);
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope");

  if (scope !== "org") {
    return Response.json(
      { error: 'scope must be "org"' },
      { status: 400 },
    );
  }

  const apiKey = await getSecret(org.id, KEY).catch(() => null);

  if (apiKey) {
    return Response.json({
      connected: true,
      scope,
      keyPrefix: apiKey.slice(0, 12) + "...",
    });
  }

  return Response.json({ connected: false, scope });
}

export async function action({ request }: { request: Request }) {
  const { role, user, org } = await requireAuth(request);

  if (!isAdminRole(role)) {
    return Response.json(
      { error: "Admin role required" },
      { status: 403 },
    );
  }

  if (request.method === "PUT") {
    const body = await request.json();
    const apiKey: string = body.apiKey;

    if (!apiKey) {
      return Response.json({ error: "apiKey is required" }, { status: 400 });
    }

    await setSecret(org.id, KEY, apiKey);
    log.info({ userId: user.id, orgId: org.id }, "claude api key saved");
    return Response.json({ success: true });
  }

  if (request.method === "DELETE") {
    await deleteSecret(org.id, KEY).catch(() => {});
    log.info({ userId: user.id, orgId: org.id }, "claude api key removed");
    return Response.json({ success: true });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
