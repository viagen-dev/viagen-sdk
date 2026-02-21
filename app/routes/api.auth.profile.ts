import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { users } from "~/lib/db/schema";
import { eq } from "drizzle-orm";
import { log } from "~/lib/logger.server";

export async function action({ request }: { request: Request }) {
  const { user } = await requireAuth(request);

  if (request.method !== "PATCH") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();

  const updates: Partial<{ name: string; email: string }> = {};

  if ("name" in body) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return Response.json({ error: "Name is required" }, { status: 400 });
    }
    if (body.name.trim().length > 32) {
      return Response.json(
        { error: "Name must be 32 characters or fewer" },
        { status: 400 },
      );
    }
    updates.name = body.name.trim();
  }

  if ("email" in body) {
    if (typeof body.email !== "string" || body.email.trim().length === 0) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email.trim())) {
      return Response.json({ error: "Invalid email address" }, { status: 400 });
    }
    updates.email = body.email.trim();
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, user.id))
      .returning();

    log.info(
      { userId: user.id, updates: Object.keys(updates) },
      "profile updated",
    );

    return Response.json({ user: updated });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("unique")) {
      return Response.json(
        { error: "Email is already in use" },
        { status: 409 },
      );
    }
    log.error({ userId: user.id, err }, "failed to update profile");
    return Response.json(
      { error: "Failed to update profile" },
      { status: 500 },
    );
  }
}
