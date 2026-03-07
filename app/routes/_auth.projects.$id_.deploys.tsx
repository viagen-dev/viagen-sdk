import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { H4 } from "~/components/ui/typography";
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "~/components/ui/item";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "~/components/ui/tooltip";
import {
  ArrowUp,
  Loader2,
  GitBranch,
  Clock,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const { org, role } = await requireAuth(request);
  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.id, params.id), eq(projects.organizationId, org.id)),
    );

  if (!project) {
    throw Response.json({ error: "Project not found" }, { status: 404 });
  }

  return { project, role };
}

interface Project {
  id: string;
  name: string;
  vercelProjectId: string | null;
  vercelProjectName: string | null;
  githubRepo: string | null;
}

interface Deployment {
  uid: string;
  name: string;
  url: string;
  state: "QUEUED" | "BUILDING" | "READY" | "ERROR" | "CANCELED";
  created: number;
  ready?: number;
  meta?: {
    githubCommitRef?: string;
    githubCommitSha?: string;
    githubCommitMessage?: string;
    githubCommitAuthorLogin?: string;
  };
  target: string | null;
  inspectorUrl?: string;
  creator?: { username: string };
}

const DEPLOY_STATE: Record<string, { label: string; className: string }> = {
  QUEUED: {
    label: "Queued",
    className:
      "gap-1.5 font-normal border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-700 dark:bg-gray-950/30 dark:text-gray-300",
  },
  BUILDING: {
    label: "Building",
    className:
      "gap-1.5 font-normal border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300",
  },
  READY: {
    label: "Ready",
    className:
      "gap-1.5 font-normal border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300",
  },
  ERROR: {
    label: "Error",
    className:
      "gap-1.5 font-normal border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300",
  },
  CANCELED: {
    label: "Canceled",
    className:
      "gap-1.5 font-normal border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300",
  },
};

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
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

export default function ProjectDeploys({
  loaderData,
}: {
  loaderData: { project: Project; role: string };
}) {
  const { project, role } = loaderData;
  const isAdmin = role === "admin" || role === "owner";

  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);

  const fetchDeployments = useCallback(async () => {
    if (!project.vercelProjectId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/projects/${project.id}/deployments`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.deployments) {
        setDeployments(data.deployments);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [project.id, project.vercelProjectId]);

  useEffect(() => {
    fetchDeployments();
  }, [fetchDeployments]);

  // Poll when there are active deployments
  const hasActiveDeployments = deployments.some(
    (d) => d.state === "BUILDING" || d.state === "QUEUED",
  );
  useEffect(() => {
    if (!hasActiveDeployments) return;
    const timer = setInterval(fetchDeployments, 5000);
    return () => clearInterval(timer);
  }, [hasActiveDeployments, fetchDeployments]);

  const handleRedeploy = async (target?: "production" | "preview") => {
    setDeploying(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/deployments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Deployment triggered");
        fetchDeployments();
      } else {
        toast.error(data.error ?? "Failed to trigger deployment");
      }
    } catch {
      toast.error("Failed to trigger deployment");
    } finally {
      setDeploying(false);
    }
  };

  if (!project.vercelProjectId) {
    return (
      <div className="space-y-6">
        <H4 className="mb-0">Deployments</H4>
        <Card className="border-dashed bg-muted/50">
          <CardContent className="flex flex-col items-center justify-center px-8 py-10">
            <p className="text-sm text-muted-foreground">
              No Vercel project linked. Connect one in{" "}
              <Link
                to={`/projects/${project.id}/settings`}
                className="underline hover:text-foreground"
              >
                Project Settings
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <H4 className="mb-0">Deployments</H4>
        {isAdmin && (
          <Button
            size="sm"
            variant="outline"
            disabled={deploying}
            onClick={() => handleRedeploy("production")}
          >
            {deploying ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ArrowUp className="size-3.5" />
            )}
            {deploying ? "Deploying..." : "Deploy"}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : deployments.length === 0 ? (
        <Card className="border-dashed bg-muted/50">
          <CardContent className="flex flex-col items-center justify-center px-8 py-10">
            <p className="text-sm text-muted-foreground">
              No deployments yet
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {deployments.map((d) => {
            const cfg = DEPLOY_STATE[d.state] ?? {
              label: d.state,
              className: "gap-1.5 font-normal",
            };
            return (
              <Item key={d.uid} variant="outline">
                <ItemContent>
                  <ItemTitle>
                    {d.meta?.githubCommitMessage
                      ? d.meta.githubCommitMessage.length > 80
                        ? d.meta.githubCommitMessage.slice(0, 80) + "..."
                        : d.meta.githubCommitMessage
                      : d.url}
                  </ItemTitle>
                  <ItemDescription>
                    <span className="flex items-center gap-3 flex-wrap">
                      <Badge variant="secondary" className={cfg.className}>
                        {d.state === "BUILDING" && (
                          <Loader2 className="size-3 animate-spin" />
                        )}
                        {cfg.label}
                      </Badge>
                      {d.meta?.githubCommitRef && (
                        <span className="flex items-center gap-1">
                          <GitBranch className="size-3" />
                          {d.meta.githubCommitRef}
                        </span>
                      )}
                      {d.target === "production" && (
                        <Badge
                          variant="outline"
                          className="text-xs font-normal"
                        >
                          Production
                        </Badge>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {timeAgo(new Date(d.created).toISOString())}
                      </span>
                      {d.creator?.username && (
                        <span className="text-xs text-muted-foreground">
                          by {d.creator.username}
                        </span>
                      )}
                    </span>
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  {d.state === "READY" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          className="sm:w-auto sm:px-2.5 sm:h-8"
                          onClick={() =>
                            window.open(`https://${d.url}`, "_blank")
                          }
                        >
                          <ExternalLink className="size-3.5" />
                          <span className="hidden sm:inline">Visit</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Open deployment</TooltipContent>
                    </Tooltip>
                  )}
                  {d.inspectorUrl && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            window.open(d.inspectorUrl, "_blank")
                          }
                        >
                          <ExternalLink className="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>View build logs</TooltipContent>
                    </Tooltip>
                  )}
                </ItemActions>
              </Item>
            );
          })}
          <a
            href={`https://vercel.com/${project.vercelProjectName ?? project.vercelProjectId}/deployments`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors text-center py-1"
          >
            View all deployments on Vercel
          </a>
        </div>
      )}
    </div>
  );
}
