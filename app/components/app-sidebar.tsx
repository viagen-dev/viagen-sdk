import { useState, useRef } from "react";
import {
  Link,
  useLocation,
  useSearchParams,
  useNavigate,
  useRevalidator,
} from "react-router";
import {
  CheckCircle2,
  Inbox,
  Bot,
  Plus,
  Box,
  FolderKanban,
  SquareDashed,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { toast } from "sonner";

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
}

export function AppSidebar({
  environments,
  projects,
  currentOrgName,
  orgPickerTrigger,
}: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [environmentsExpanded, setEnvironmentsExpanded] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [savingProject, setSavingProject] = useState(false);
  const newProjectInputRef = useRef<HTMLInputElement>(null);

  const sortedProjects = [...projects]
    .filter((p) => !p.isDefault)
    .sort((a, b) => a.name.localeCompare(b.name));

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

  const startCreating = () => {
    setProjectsExpanded(true);
    setCreatingProject(true);
    setNewProjectName("");
    setTimeout(() => newProjectInputRef.current?.focus(), 0);
  };

  const cancelCreating = () => {
    setCreatingProject(false);
    setNewProjectName("");
  };

  const saveNewProject = async () => {
    const name = newProjectName.trim();
    if (!name) {
      cancelCreating();
      return;
    }
    setSavingProject(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create project");
        return;
      }
      setCreatingProject(false);
      setNewProjectName("");
      revalidator.revalidate();
      navigate(`/projects/${data.project.id}`);
    } catch {
      toast.error("Failed to create project");
    } finally {
      setSavingProject(false);
    }
  };

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
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setProjectsExpanded((prev) => !prev)}
            className="flex flex-1 items-center gap-1 px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {projectsExpanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            <span>Projects</span>
          </button>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={startCreating}
                className="flex items-center justify-center size-5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                aria-label="New project"
              >
                <Plus className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">New project</TooltipContent>
          </Tooltip>
        </div>

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
                  {proj.isDefault ? (
                    <SquareDashed className="size-4" />
                  ) : (
                    <FolderKanban className="size-4" />
                  )}
                  <span className="truncate">{proj.name}</span>
                </Link>
              </Button>
            ))}

            {/* Inline new project input */}
            {creatingProject && (
              <div className="flex items-center gap-1.5 px-2 py-1">
                <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
                <Input
                  ref={newProjectInputRef}
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveNewProject();
                    }
                    if (e.key === "Escape") {
                      cancelCreating();
                    }
                  }}
                  onBlur={saveNewProject}
                  placeholder="Project name…"
                  disabled={savingProject}
                  className="h-6 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
                />
                {savingProject && (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Environments section */}
      <div className="flex flex-col gap-1 mt-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setEnvironmentsExpanded((prev) => !prev)}
            className="flex flex-1 items-center gap-1 px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {environmentsExpanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            <span>Environments</span>
          </button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/environments/new"
                className="flex items-center justify-center size-5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                aria-label="New environment"
              >
                <Plus className="size-3.5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">New environment</TooltipContent>
          </Tooltip>
        </div>

        {environmentsExpanded && (
          <div className="flex flex-col gap-0.5">
            {sortedEnvironments.map((env) => (
              <Button
                key={env.id}
                variant="ghost"
                size="sm"
                asChild
                className={cn(
                  "w-full justify-start gap-2",
                  location.pathname === `/environments/${env.id}/settings` &&
                    "bg-accent text-accent-foreground",
                )}
              >
                <Link to={`/environments/${env.id}/settings`}>
                  <Box className="size-4" />
                  <span className="truncate">{env.name}</span>
                </Link>
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
