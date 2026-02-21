import { requireUser } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { organizations, orgMembers } from "~/lib/db/schema";
import { eq } from "drizzle-orm";
import { log } from "~/lib/logger.server";

export async function loader({ request }: { request: Request }) {
  const session = await requireUser(request);

  return Response.json({
    organizations: session.memberships.map((m) => ({
      id: m.organizationId,
      name: m.organizationName,
      role: m.role,
    })),
  });
}

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const session = await requireUser(request);
  const body = await request.json();

  if (
    !body.name ||
    typeof body.name !== "string" ||
    body.name.trim().length === 0
  ) {
    return Response.json(
      { error: "Organization name is required" },
      { status: 400 },
    );
  }

  const [org] = await db
    .insert(organizations)
    .values({ name: body.name.trim() })
    .returning();

  await db.insert(orgMembers).values({
    userId: session.user.id,
    organizationId: org.id,
    role: "owner",
  });

  log.info(
    { userId: session.user.id, orgId: org.id, orgName: org.name },
    "organization created",
  );
  return Response.json(
    {
      organization: { id: org.id, name: org.name },
    },
    { status: 201 },
  );
}
