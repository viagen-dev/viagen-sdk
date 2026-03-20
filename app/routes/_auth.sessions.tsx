import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Bot, Loader2, Zap } from "lucide-react";
import { Button } from "~/components/ui/button";
import { SidebarToggle } from "~/components/sidebar-toggle";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { environments } from "~/lib/db/schema";
import { eq } from "drizzle-orm";

// ── Loader ────────────────────────────────────────────────────────────────

export async function loader({ request }: { request: Request }) {
  const { org } = await requireAuth(request);
  const rows = await db
    .select({ id: environments.id, name: environments.name })
    .from(environments)
    .where(eq(environments.organizationId, org.id));
  return { environments: rows };
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function MySessionsPage({
  loaderData,
}: {
  loaderData: { environments: { id: string; name: string }[] };
}) {
  const [launchingWs, setLaunchingWs] = useState(false);

  const handleStartSession = useCallback(async () => {
    const pid = loaderData.environments[0]?.id;
    if (!pid) {
      toast.error("No environment available");
      return;
    }
    const branch = `sandbox-${Math.random().toString(36).slice(2, 8)}`;
    console.log(
      "[MySessions] Launching workspace for environment:",
      pid,
      "branch:",
      branch,
    );
    setLaunchingWs(true);
    try {
      const res = await fetch(`/api/environments/${pid}/sandbox`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch }),
      });
      const data = await res.json();
      if (res.ok && data.workspace) {
        console.log(
          "[MySessions] Workspace launched successfully:",
          data.workspace.url,
        );
        toast.success("Workspace launched");
        window.open(data.workspace.url, "_blank");
      } else {
        console.error("[MySessions] Workspace launch failed:", data.error);
        toast.error(data.error ?? "Failed to launch workspace");
      }
    } catch (err) {
      console.error("[MySessions] Workspace launch error:", err);
      toast.error("Failed to launch workspace");
    } finally {
      setLaunchingWs(false);
    }
  }, [loaderData.environments]);

  return (
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          <SidebarToggle />
          <h1 className="text-base font-semibold">My sessions</h1>
        </div>
        <Button
          variant="default"
          size="sm"
          className="shadow-none"
          onClick={handleStartSession}
          disabled={launchingWs || loaderData.environments.length === 0}
        >
          {launchingWs ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
          ) : (
            <Bot className="h-4 w-4 mr-1.5" />
          )}
          Start session
        </Button>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center h-full py-24 gap-6 select-none">
        {/* Illustration */}
        <div className="relative">
          {/* Spinning dashed ring */}
          <div
            className="absolute inset-0 rounded-full border border-dashed border-muted-foreground/20 animate-spin [animation-duration:10s]"
            style={{ margin: "-20px" }}
          />
          {/* Soft glow */}
          <div
            className="absolute inset-0 rounded-full bg-primary/10 blur-xl animate-pulse"
            style={{ margin: "-10px" }}
          />
          {/* Central icon tile */}
          <div className="relative flex items-center justify-center size-16 rounded-2xl bg-muted border border-border shadow-sm">
            <Bot className="size-8 text-muted-foreground" />
            {/* Zap badge */}
            <div className="absolute -top-2 -right-2 flex items-center justify-center size-5 rounded-full bg-primary text-primary-foreground shadow">
              <Zap className="size-3 fill-current" />
            </div>
          </div>
        </div>

        {/* Copy */}
        <div className="flex flex-col items-center gap-2 text-center max-w-xs">
          <p className="text-sm font-medium">We're working on this page…</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Sessions are coming soon. You'll be able to track active sandboxes
            and running agents right here.
          </p>
        </div>
      </div>
    </div>
  );
}
