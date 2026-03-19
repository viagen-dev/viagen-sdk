import { Link } from "react-router";
import { ArrowLeft, FolderKanban } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import {
  STATUS_CONFIG,
  timeAgo,
  shortTaskId,
} from "~/components/task-detail-panel";
import { cn } from "~/lib/utils";

import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects, tasks, environments, users } from "~/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { log } from "~/lib/logger.server";

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const { org } = await requireAuth(request);

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, params.id), eq(projects.organizationId, org.id)));

  if (!project) {
    log.warn({ projectId: params.id }, "project detail: not found");
    throw Response.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch tasks belonging to this project
  const projectTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      prompt: tasks.prompt,
      status: tasks.status,
      branch: tasks.branch,
      taskNumber: tasks.taskNumber,
      prUrl: tasks.prUrl,
      createdAt: tasks.createdAt,
      completedAt: tasks.completedAt,
      environmentId: tasks.environmentId,
      creatorName: users.name,
    })
    .from(tasks)
    .innerJoin(users, eq(tasks.createdBy, users.id))
    .where(eq(tasks.projectId, project.id))
    .orderBy(desc(tasks.createdAt))
    .limit(100);

  log.debug(
    { projectId: project.id, taskCount: projectTasks.length },
    "project detail loaded",
  );

  return { project, tasks: projectTasks };
}

type TaskRow = {
  id: string;
  title: string | null;
  prompt: string;
  status: string;
  branch: string;
  taskNumber: number | null;
  prUrl: string | null;
  createdAt: string;
  completedAt: string | null;
  environmentId: string;
  creatorName: string | null;
};

export default function ProjectDetail({
  loaderData,
}: {
  loaderData: {
    project: { id: string; name: string; taskPrefix: string | null };
    tasks: TaskRow[];
  };
}) {
  const { project, tasks } = loaderData;

  return (
    <div className="mx-auto w-full max-w-[900px]">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link to="/dashboard">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <FolderKanban className="size-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold">{project.name}</h1>
        {project.taskPrefix && (
          <Badge variant="secondary" className="text-xs font-mono">
            {project.taskPrefix}
          </Badge>
        )}
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <Card className="border-dashed bg-muted/50">
          <CardContent className="flex flex-col items-center justify-center px-8 py-16">
            <p className="text-lg font-medium mb-1">No tasks yet</p>
            <p className="text-sm text-muted-foreground">
              Tasks assigned to this project will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((task) => {
            const config = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.ready;
            const StatusIcon = config.icon;
            return (
              <Link
                key={task.id}
                to={`/environments/${task.environmentId}/tasks/${task.id}`}
                className="group flex items-center gap-3 rounded-lg border border-border bg-background p-4 transition-all hover:border-foreground/20"
              >
                <StatusIcon
                  className={cn(
                    "size-4 shrink-0",
                    config.className,
                    task.status === "running" && "animate-spin",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {task.title || task.prompt.slice(0, 80)}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono shrink-0">
                      {shortTaskId(task.id, {
                        prefix: project.taskPrefix,
                        environmentName: project.name,
                        taskNumber: task.taskNumber,
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {task.creatorName ?? "Unknown"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(task.createdAt)}
                    </span>
                  </div>
                </div>
                <Badge variant="outline" className={config.badgeClassName}>
                  {config.label}
                </Badge>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
