import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Loader2,
  GitBranch,
  ExternalLink,
  Columns2,
  Code,
  Square,
  Copy,
  Check,
} from "lucide-react";

interface Workspace {
  id: string;
  sandboxId: string;
  url: string;
  expiresAt: string;
  branch: string;
  taskId: string | null;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Extract sandbox domain and auth token from any workspace URL variant. */
function parseWsUrl(url: string) {
  const match = url.match(/^(https?:\/\/[^/]+).*\/t\/([^/]+)$/);
  if (!match) return { domain: url, token: "" };
  return { domain: match[1], token: match[2] };
}

export function WorkspaceList({
  projectId,
  workspaces,
  onStopped,
}: {
  projectId: string;
  workspaces: Workspace[];
  onStopped: (id: string) => void;
}) {
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleStop = async (workspaceId: string) => {
    setStoppingId(workspaceId);
    try {
      const res = await fetch(`/api/projects/${projectId}/sandbox`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (res.ok) {
        onStopped(workspaceId);
      }
    } catch {
      // ignore
    } finally {
      setStoppingId(null);
    }
  };

  if (workspaces.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">
        Active Workspaces
      </h2>
      <div className="flex flex-col gap-2">
        {workspaces.map((ws) => {
          const { domain, token } = parseWsUrl(ws.url);
          const viewUrl = `${domain}/t/${token}`;
          const splitUrl = `${domain}/via/iframe/t/${token}`;
          const codeUrl = `${domain}/via/ui/t/${token}`;

          return (
            <div
              key={ws.id}
              className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="font-medium">{ws.branch}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {timeAgo(ws.createdAt)}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  size="icon-sm"
                  variant="outline"
                  className="size-7"
                  title="View app"
                  asChild
                >
                  <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-3.5" />
                  </a>
                </Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  className="size-7"
                  title="Split view"
                  asChild
                >
                  <a href={splitUrl} target="_blank" rel="noopener noreferrer">
                    <Columns2 className="size-3.5" />
                  </a>
                </Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  className="size-7"
                  title="Code panel"
                  asChild
                >
                  <a href={codeUrl} target="_blank" rel="noopener noreferrer">
                    <Code className="size-3.5" />
                  </a>
                </Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  className="size-7"
                  onClick={() => {
                    navigator.clipboard.writeText(ws.url);
                    setCopiedId(ws.id);
                    setTimeout(() => setCopiedId(null), 2000);
                  }}
                  title="Copy URL"
                >
                  {copiedId === ws.id ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  className="size-7 text-destructive hover:bg-destructive/10"
                  disabled={stoppingId === ws.id}
                  onClick={() => handleStop(ws.id)}
                  title="Stop workspace"
                >
                  {stoppingId === ws.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Square className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
