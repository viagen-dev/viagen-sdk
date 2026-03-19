import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { isNull, eq } from "drizzle-orm";
import { tasks, environments, organizations } from "../app/lib/db/schema";
import { getSecret } from "../app/lib/infisical.server";

const db = drizzle(process.env.DATABASE_URL!);

const CONCURRENCY = 3;
const RATE_LIMIT_MS = 500; // delay between batches to avoid hammering the API

async function generateTitle(
  apiKey: string,
  prompt: string,
): Promise<string | null> {
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
      messages: [{ role: "user", content: prompt.slice(0, 500) }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  const raw: string = data?.content?.[0]?.text ?? "";
  const title = raw.trim().replace(/^["']|["']$/g, "").trim();
  return title.slice(0, 255) || null;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processChunk(
  chunk: { id: string; prompt: string; orgId: string; apiKey: string }[],
): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;

  await Promise.all(
    chunk.map(async (row) => {
      try {
        const title = await generateTitle(row.apiKey, row.prompt);
        if (title) {
          await db
            .update(tasks)
            .set({ title })
            .where(eq(tasks.id, row.id));
          console.log(`  [${row.id.slice(0, 8)}] → "${title}"`);
          ok++;
        } else {
          console.warn(`  [${row.id.slice(0, 8)}] generated empty title — skipping`);
          failed++;
        }
      } catch (err) {
        console.error(
          `  [${row.id.slice(0, 8)}] failed: ${err instanceof Error ? err.message : err}`,
        );
        failed++;
      }
    }),
  );

  return { ok, failed };
}

async function main() {
  console.log("Fetching untitled tasks…\n");

  // Fetch all untitled tasks joined with their project → org
  const rows = await db
    .select({
      taskId: tasks.id,
      prompt: tasks.prompt,
      orgId: organizations.id,
    })
    .from(tasks)
    .innerJoin(environments, eq(tasks.environmentId, environments.id))
    .innerJoin(organizations, eq(environments.organizationId, organizations.id))
    .where(isNull(tasks.title));

  if (rows.length === 0) {
    console.log("No untitled tasks found. Nothing to do.");
    process.exit(0);
  }

  console.log(`Found ${rows.length} untitled task(s).\n`);

  // Group by org so we only fetch each org's API key once
  const byOrg = new Map<string, { taskId: string; prompt: string }[]>();
  for (const row of rows) {
    const existing = byOrg.get(row.orgId);
    if (existing) {
      existing.push({ taskId: row.taskId, prompt: row.prompt });
    } else {
      byOrg.set(row.orgId, [{ taskId: row.taskId, prompt: row.prompt }]);
    }
  }

  let totalOk = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const [orgId, orgTasks] of byOrg) {
    console.log(`Org ${orgId} — ${orgTasks.length} task(s)`);

    const apiKey = await getSecret(orgId, "ANTHROPIC_API_KEY");
    if (!apiKey) {
      console.warn(
        `  No ANTHROPIC_API_KEY for org ${orgId} — skipping ${orgTasks.length} task(s)\n`,
      );
      totalSkipped += orgTasks.length;
      continue;
    }

    // Enrich with api key
    const enriched = orgTasks.map((t) => ({
      id: t.taskId,
      prompt: t.prompt,
      orgId,
      apiKey,
    }));

    // Process in chunks of CONCURRENCY with a short pause between each
    for (let i = 0; i < enriched.length; i += CONCURRENCY) {
      const chunk = enriched.slice(i, i + CONCURRENCY);
      const { ok, failed } = await processChunk(chunk);
      totalOk += ok;
      totalFailed += failed;

      if (i + CONCURRENCY < enriched.length) {
        await sleep(RATE_LIMIT_MS);
      }
    }

    console.log();
  }

  console.log("────────────────────────────────");
  console.log(`Done.`);
  console.log(`  Generated : ${totalOk}`);
  console.log(`  Failed    : ${totalFailed}`);
  console.log(`  Skipped   : ${totalSkipped} (no API key)`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
