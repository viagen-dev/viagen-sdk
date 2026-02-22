import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Loader2,
  GitBranch,
  ExternalLink,
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
        {workspaces.map((ws) => (
          <div
            key={ws.id}
            className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="font-medium">{ws.branch}</span>
              <span className="text-xs text-muted-foreground">
                {timeAgo(ws.createdAt)}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                asChild
              >
                <a href={ws.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3" />
                  View
                </a>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                onClick={() => {
                  navigator.clipboard.writeText(ws.url);
                  setCopiedId(ws.id);
                  setTimeout(() => setCopiedId(null), 2000);
                }}
              >
                {copiedId === ws.id ? (
                  <Check className="size-3" />
                ) : (
                  <Copy className="size-3" />
                )}
                {copiedId === ws.id ? "Copied" : "Copy"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs text-destructive hover:bg-destructive/10"
                disabled={stoppingId === ws.id}
                onClick={() => handleStop(ws.id)}
              >
                {stoppingId === ws.id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Square className="size-3" />
                )}
                Stop
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
