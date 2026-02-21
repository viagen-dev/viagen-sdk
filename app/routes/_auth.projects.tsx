import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useRouteLoaderData } from "react-router";
import {
  Search,
  Plus,
  Ellipsis,
  Sparkles,
  X,
  Check,
  Circle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects } from "~/lib/db/schema";
import { eq } from "drizzle-orm";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Small, Muted, Large } from "~/components/ui/typography";
import {
  Card,
  CardContent,
  CardHeader,
  CardAction,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
} from "~/components/ui/item";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "~/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "~/components/ui/command";

export async function loader({ request }: { request: Request }) {
  const { org } = await requireAuth(request);
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.organizationId, org.id));
  return { projects: rows };
}

interface Project {
  id: string;
  name: string;
  templateId: string | null;
  vercelProjectId: string | null;
  githubRepo: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProjectStatus {
  ready: boolean;
  github: { linked: boolean; tokenAvailable: boolean };
  vercel: { linked: boolean; tokenAvailable: boolean };
  claude: { connected: boolean; source?: string; keyPrefix?: string };
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
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

function projectInitials(name: string): string {
  return name
    .split(/[\s-_]+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface ParentData {
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
  currentOrg: { id: string; name: string };
  organizations: { id: string; name: string; role: string }[];
  integrations: { github: boolean; vercel: boolean };
}

export default function Projects({
  loaderData,
}: {
  loaderData: { projects: Project[] };
}) {
  const { projects } = loaderData;
  const navigate = useNavigate();
  const parentData = useRouteLoaderData("routes/_auth") as
    | ParentData
    | undefined;
  const integrations = parentData?.integrations;
  const missingIntegrations = !integrations?.github || !integrations?.vercel;

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [statuses, setStatuses] = useState<Record<string, ProjectStatus>>({});

  useEffect(() => {
    if (projects.length === 0) return;
    Promise.all(
      projects.map(async (p) => {
        try {
          const res = await fetch(`/api/projects/${p.id}/status`, {
            credentials: "include",
          });
          const data = await res.json();
          return [p.id, data] as const;
        } catch {
          return [
            p.id,
            {
              ready: false,
              github: { linked: false, tokenAvailable: false },
              vercel: { linked: false, tokenAvailable: false },
              claude: { connected: false },
            },
          ] as const;
        }
      }),
    ).then((entries) => {
      setStatuses(Object.fromEntries(entries));
    });
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.githubRepo?.toLowerCase().includes(q) ||
        p.vercelProjectId?.toLowerCase().includes(q) ||
        p.templateId?.toLowerCase().includes(q),
    );
  }, [projects, search]);

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <Popover open={open && search.trim().length > 0} onOpenChange={setOpen}>
          <PopoverAnchor asChild>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (e.target.value.trim()) setOpen(true);
                }}
                onFocus={() => {
                  if (search.trim()) setOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setOpen(false);
                    inputRef.current?.blur();
                  }
                }}
                className="bg-background pl-9 pr-9"
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch("");
                    setOpen(false);
                    inputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </PopoverAnchor>
          <PopoverContent
            className="w-(--radix-popover-trigger-width) p-0"
            align="start"
            sideOffset={6}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <Command shouldFilter={false}>
              <CommandList>
                {filteredProjects.length === 0 ? (
                  <CommandEmpty>
                    No projects match &ldquo;{search}&rdquo;
                  </CommandEmpty>
                ) : (
                  <>
                    <CommandGroup heading="Projects">
                      {filteredProjects.slice(0, 5).map((p) => (
                        <CommandItem
                          key={p.id}
                          value={p.id}
                          onSelect={() => {
                            setOpen(false);
                            navigate(`/projects/${p.id}`);
                          }}
                        >
                          <Avatar size="sm">
                            {p.vercelProjectId && (
                              <AvatarImage
                                src={`https://${p.vercelProjectId}.vercel.app/favicon.ico`}
                                alt={p.name}
                              />
                            )}
                            <AvatarFallback className="bg-foreground text-background text-[0.5rem] font-semibold">
                              {projectInitials(p.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <Small className="truncate">{p.name}</Small>
                            {p.githubRepo && (
                              <Muted className="truncate text-xs">
                                {p.githubRepo}
                              </Muted>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    {filteredProjects.length > 5 && (
                      <>
                        <CommandSeparator />
                        <CommandGroup>
                          <CommandItem
                            onSelect={() => {
                              setOpen(false);
                              inputRef.current?.focus();
                            }}
                            className="justify-center text-xs text-muted-foreground"
                          >
                            {filteredProjects.length - 5} more result
                            {filteredProjects.length - 5 > 1 ? "s" : ""}
                            &hellip;
                          </CommandItem>
                        </CommandGroup>
                      </>
                    )}
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild size="icon" className="sm:hidden">
              <Link to="/projects/new">
                <Plus />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add project</TooltipContent>
        </Tooltip>
        <Button asChild className="hidden sm:inline-flex">
          <Link to="/projects/new">
            <Plus />
            Add project
          </Link>
        </Button>
      </div>

      {projects.length === 0 ? (
        <Card className="border-dashed bg-muted/50">
          <CardContent className="flex flex-col items-center justify-center px-8 py-16">
            <Large className="mb-2">No projects yet</Large>
            <Muted className="text-center">
              Create your first project to get started
            </Muted>
            <Button asChild className="mt-4">
              <Link to="/projects/new">New Project</Link>
            </Button>
          </CardContent>
        </Card>
      ) : filteredProjects.length === 0 ? (
        <Card className="border-dashed bg-muted/50">
          <CardContent className="flex flex-col items-center justify-center px-8 py-16">
            <Search className="mb-3 size-8 text-muted-foreground/50" />
            <Large className="mb-1">No projects found</Large>
            <Muted className="mb-4 text-center">
              No projects match &ldquo;{search}&rdquo;
            </Muted>
            <Button variant="outline" size="sm" onClick={() => setSearch("")}>
              Clear search
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div
          className={
            missingIntegrations
              ? "flex flex-col items-start gap-6 md:flex-row"
              : ""
          }
        >
          {missingIntegrations && (
            <div className="w-full shrink-0 md:w-[380px]">
              <CardTitle className="mb-4">Getting started</CardTitle>
              <Card className="sticky top-8">
                <CardHeader>
                  <CardTitle>Connect accounts</CardTitle>
                  <CardDescription>
                    Connect your accounts to unlock the full experience.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-1">
                  <Item size="sm" variant="outline">
                    <ItemMedia variant="icon">
                      <GitHubIcon />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>Connect GitHub</ItemTitle>
                    </ItemContent>
                    {!integrations?.github && (
                      <Button size="sm" asChild>
                        <Link to="/settings?tab=user">Connect</Link>
                      </Button>
                    )}
                  </Item>
                  <Item size="sm" variant="outline">
                    <ItemMedia variant="icon">
                      <VercelIcon />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>Connect Vercel</ItemTitle>
                    </ItemContent>
                    {!integrations?.vercel && (
                      <Button size="sm" asChild>
                        <Link to="/settings?tab=user">Connect</Link>
                      </Button>
                    )}
                  </Item>
                  <Item size="sm" variant="outline">
                    <ItemMedia variant="icon">
                      <Sparkles className="size-3" />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>Connect Claude</ItemTitle>
                    </ItemContent>
                    <Button size="sm" asChild>
                      <Link to="/settings?tab=user">Connect</Link>
                    </Button>
                  </Item>
                </CardContent>
              </Card>
            </div>
          )}
          <div className="min-w-0 w-full flex-1">
            <CardTitle className="mb-4">Projects</CardTitle>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
              {filteredProjects.map((project) => (
                <Card
                  key={project.id}
                  className="cursor-pointer transition-colors hover:border-foreground/20"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        {project.vercelProjectId && (
                          <AvatarImage
                            src={`https://${project.vercelProjectId}.vercel.app/favicon.ico`}
                            alt={project.name}
                          />
                        )}
                        <AvatarFallback className="bg-foreground text-background text-xs font-semibold">
                          {projectInitials(project.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/projects/${project.id}`}
                          className="text-sm font-semibold text-foreground no-underline hover:underline"
                        >
                          {project.name}
                        </Link>
                      </div>
                    </div>
                    <CardAction>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Ellipsis className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenuItem asChild>
                            <Link to={`/projects/${project.id}/settings`}>
                              Project settings
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardAction>
                  </CardHeader>

                  <CardContent className="flex flex-col gap-2">
                    <Badge
                      variant="secondary"
                      className={
                        statuses[project.id]?.github.linked &&
                        statuses[project.id]?.github.tokenAvailable
                          ? "gap-1.5 font-normal border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
                          : "gap-1.5 font-normal"
                      }
                    >
                      <GitHubIcon />
                      {project.githubRepo ?? "GitHub not connected"}
                    </Badge>

                    <Badge
                      variant="secondary"
                      className={
                        statuses[project.id]?.vercel.tokenAvailable
                          ? "gap-1.5 font-normal border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
                          : "gap-1.5 font-normal"
                      }
                    >
                      <VercelIcon />
                      {project.vercelProjectId
                        ? project.vercelProjectId
                        : statuses[project.id]?.vercel.tokenAvailable
                          ? "Vercel ready"
                          : "Vercel not connected"}
                    </Badge>

                    <Badge variant="secondary" className="gap-1.5 font-normal">
                      <Sparkles className="size-3" />
                      {statuses[project.id]?.claude.connected
                        ? "Claude connected"
                        : "Claude not connected"}
                    </Badge>

                    <Muted className="flex items-center gap-1.5 pt-1 text-xs">
                      {timeAgo(project.updatedAt)}
                    </Muted>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VercelIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 76 65"
      fill="currentColor"
      className="shrink-0"
    >
      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="shrink-0"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
