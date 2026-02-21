import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, asc } from "drizzle-orm";
import { orgMembers, organizations } from "../app/lib/db/schema";

async function main() {
  const db = drizzle(process.env.DATABASE_URL!);

  const orgs = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations);

  console.log(`Found ${orgs.length} organization(s)\n`);

  for (const org of orgs) {
    // Get all members ordered by createdAt ascending (earliest first)
    const members = await db
      .select({
        userId: orgMembers.userId,
        role: orgMembers.role,
        createdAt: orgMembers.createdAt,
      })
      .from(orgMembers)
      .where(eq(orgMembers.organizationId, org.id))
      .orderBy(asc(orgMembers.createdAt));

    if (members.length === 0) {
      console.log(`[${org.name}] No members — skipping`);
      continue;
    }

    const earliest = members[0];

    if (earliest.role === "owner") {
      console.log(
        `[${org.name}] Already has owner (user ${earliest.userId}) — skipping`,
      );
      continue;
    }

    // Check if any member already has the owner role
    const existingOwner = members.find((m) => m.role === "owner");
    if (existingOwner) {
      console.log(
        `[${org.name}] Owner already exists (user ${existingOwner.userId}) — skipping`,
      );
      continue;
    }

    // Promote the earliest member to owner
    await db
      .update(orgMembers)
      .set({ role: "owner" })
      .where(
        and(
          eq(orgMembers.userId, earliest.userId),
          eq(orgMembers.organizationId, org.id),
        ),
      );

    console.log(
      `[${org.name}] Promoted user ${earliest.userId} from "${earliest.role}" to "owner"`,
    );
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
