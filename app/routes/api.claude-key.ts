import { requireAuth, isAdminRole } from "~/lib/session.server";
import { getSecret, setSecret, deleteSecret } from "~/lib/infisical.server";
import { log } from "~/lib/logger.server";

const KEY = "ANTHROPIC_API_KEY";

function pathForScope(
  scope: string,
  orgId: string,
  userId: string,
): string | null {
  if (scope === "org") return orgId;
  if (scope === "user") return `user/${userId}`;
  return null;
}

export async function loader({ request }: { request: Request }) {
  const { user, org } = await requireAuth(request);
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope");

  if (scope !== "org" && scope !== "user") {
    return Response.json(
      { error: 'scope must be "org" or "user"' },
      { status: 400 },
    );
  }

  const path = pathForScope(scope, org.id, user.id)!;
  const apiKey = await getSecret(path, KEY).catch(() => null);

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

  if (request.method === "PUT") {
    const body = await request.json();
    const scope: string = body.scope;
    const apiKey: string = body.apiKey;

    if (!apiKey) {
      return Response.json({ error: "apiKey is required" }, { status: 400 });
    }
    if (scope !== "org" && scope !== "user") {
      return Response.json(
        { error: 'scope must be "org" or "user"' },
        { status: 400 },
      );
    }
    if (scope === "org" && !isAdminRole(role)) {
      return Response.json(
        { error: "Admin role required to set org key" },
        { status: 403 },
      );
    }

    const path = pathForScope(scope, org.id, user.id)!;
    await setSecret(path, KEY, apiKey);
    log.info({ userId: user.id, scope }, "claude api key saved");
    return Response.json({ success: true });
  }

  if (request.method === "DELETE") {
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope");

    if (scope !== "org" && scope !== "user") {
      return Response.json(
        { error: 'scope must be "org" or "user"' },
        { status: 400 },
      );
    }
    if (scope === "org" && !isAdminRole(role)) {
      return Response.json(
        { error: "Admin role required to remove org key" },
        { status: 403 },
      );
    }

    const path = pathForScope(scope, org.id, user.id)!;
    await deleteSecret(path, KEY).catch(() => {});
    log.info({ userId: user.id, scope }, "claude api key removed");
    return Response.json({ success: true });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
