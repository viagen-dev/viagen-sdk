import { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import {
  CheckCircle2,
  Inbox,
  Bot,
  Plus,
  Box,
  FolderKanban,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

interface AppSidebarProps {
  environments: Array<{ id: string; name: string }>;
  projects: Array<{
    id: string;
    name: string;
    taskPrefix: string | null;
    isDefault: boolean;
  }>;
  currentOrgName: string;
  orgPickerTrigger: React.ReactNode;
  selectedEnvironmentId?: string | null;
  onEnvironmentSelect?: (environmentId: string) => void;
}

export function AppSidebar({
  environments,
  projects,
  currentOrgName,
  orgPickerTrigger,
  selectedEnvironmentId,
  onEnvironmentSelect,
}: AppSidebarProps) {
  const location = useLocation();
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [environmentsExpanded, setEnvironmentsExpanded] = useState(false);

  const sortedProjects = [...projects].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const sortedEnvironments = [...environments].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const isInboxActive = location.pathname === "/inbox";
  const [searchParams] = useSearchParams();
  const activeProjectId = location.pathname.startsWith("/projects/")
    ? location.pathname.split("/")[2]
    : (searchParams.get("projectId") ?? null);
  const isTasksActive =
    (location.pathname === "/tasks" ||
      location.pathname.startsWith("/tasks/") ||
      /\/environments\/[^/]+\/tasks\//.test(location.pathname)) &&
    !activeProjectId;
  const isSessionsActive = location.pathname === "/sessions";

  return (
    <aside className="flex h-full w-[217px] shrink-0 flex-col border-r border-border bg-background p-4">
      {/* Org picker */}
      <div className="mb-4">{orgPickerTrigger}</div>

      {/* Inbox + My tasks + My team */}
      <div className="flex flex-col gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className={cn(
            "w-full justify-start gap-2",
            isInboxActive && "bg-accent text-accent-foreground",
          )}
        >
          <Link to="/inbox">
            <Inbox className="size-4" />
            <span>Inbox</span>
          </Link>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          asChild
          className={cn(
            "w-full justify-start gap-2",
            isTasksActive && "bg-accent text-accent-foreground",
          )}
        >
          <Link to="/tasks">
            <CheckCircle2 className="size-4" />
            <span>My tasks</span>
          </Link>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          asChild
          className={cn(
            "w-full justify-start gap-2",
            isSessionsActive && "bg-accent text-accent-foreground",
          )}
        >
          <Link to="/sessions">
            <Bot className="size-4" />
            <span>My sessions</span>
          </Link>
        </Button>
      </div>

      {/* Projects section */}
      <div className="flex flex-col gap-1 mt-4">
        <button
          type="button"
          onClick={() => setProjectsExpanded((prev) => !prev)}
          className="flex w-full items-center gap-1 px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {projectsExpanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
          <span>Projects</span>
        </button>

        {projectsExpanded && (
          <div className="flex flex-col gap-0.5">
            {sortedProjects.map((proj) => (
              <Button
                key={proj.id}
                variant="ghost"
                size="sm"
                asChild
                className={cn(
                  "w-full justify-start gap-2",
                  activeProjectId === proj.id &&
                    "bg-accent text-accent-foreground",
                )}
              >
                <Link to={`/projects/${proj.id}`}>
                  <FolderKanban className="size-4" />
                  <span className="truncate">{proj.name}</span>
                </Link>
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Environments section */}
      <div className="flex flex-col gap-1 mt-4">
        <button
          type="button"
          onClick={() => setEnvironmentsExpanded((prev) => !prev)}
          className="flex w-full items-center gap-1 px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {environmentsExpanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
          <span>Environments</span>
        </button>

        {environmentsExpanded && (
          <div className="flex flex-col gap-0.5">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="w-full justify-start gap-2 shadow-none"
            >
              <Link to="/environments/new">
                <Plus className="size-4" />
                <span>New environment</span>
              </Link>
            </Button>

            {sortedEnvironments.map((env) => (
              <Button
                key={env.id}
                variant="ghost"
                size="sm"
                className={cn(
                  "w-full justify-start gap-2",
                  selectedEnvironmentId === env.id &&
                    "bg-accent text-accent-foreground",
                )}
                onClick={() => onEnvironmentSelect?.(env.id)}
              >
                <Box className="size-4" />
                <span className="truncate">{env.name}</span>
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Spacer pushes footer to bottom */}
      <div className="flex-1" />
    </aside>
  );
}
