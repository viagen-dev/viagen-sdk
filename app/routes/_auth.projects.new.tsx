import { useState } from "react";
import { Link, useNavigate, useRouteLoaderData } from "react-router";
import { X, Plus, Loader2, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "~/components/ui/item";
import { Badge } from "~/components/ui/badge";
import { H3, Small, Muted } from "~/components/ui/typography";
import { ResourcePicker } from "~/components/resource-picker";

const TEMPLATES = [
  {
    id: "react-router",
    name: "React Router",
    description: "Full-stack React with SSR, loaders, and actions" as
      | string
      | React.ReactNode,
    framework: "React",
    repo: "viagen-dev/viagen-react-router",
  },
  {
    id: "bring-your-own",
    name: "Bring Your Own",
    description: (
      <>
        Use any framework — must have{" "}
        <a
          href="https://viagen.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          viagen installed
        </a>
      </>
    ) as string | React.ReactNode,
    framework: null,
    repo: null,
  },
];

interface GithubRepo {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
  url: string;
}

interface VercelProject {
  id: string;
  name: string;
  framework: string | null;
  accountId?: string;
  link?: { type: string; org: string; repo: string };
}

interface AuthLoaderData {
  integrations: { github: boolean; vercel: boolean; claude: boolean };
}

export default function NewProject() {
  const navigate = useNavigate();
  const parentData = useRouteLoaderData("routes/_auth") as
    | AuthLoaderData
    | undefined;
  const githubConnected = parentData?.integrations.github ?? false;
  const vercelConnected = parentData?.integrations.vercel ?? false;

  // Form state
  const [name, setName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(
    TEMPLATES[0].id,
  );
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // GitHub state
  const [githubRepos, setGithubRepos] = useState<GithubRepo[]>([]);
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [selectedGithubRepo, setSelectedGithubRepo] =
    useState<GithubRepo | null>(null);
  const [githubFetched, setGithubFetched] = useState(false);

  // GitHub create-new state
  const [showCreateRepo, setShowCreateRepo] = useState(false);
  const [newRepoName, setNewRepoName] = useState("");
  const [creatingRepo, setCreatingRepo] = useState(false);

  // Vercel state
  const [vercelProjects, setVercelProjects] = useState<VercelProject[]>([]);
  const [vercelLoading, setVercelLoading] = useState(false);
  const [vercelError, setVercelError] = useState<string | null>(null);
  const [selectedVercel, setSelectedVercel] = useState<VercelProject | null>(
    null,
  );
  const [vercelFetched, setVercelFetched] = useState(false);

  // Vercel create-new state
  const [showCreateVercel, setShowCreateVercel] = useState(false);
  const [newVercelName, setNewVercelName] = useState("");
  const [creatingVercel, setCreatingVercel] = useState(false);

  // Lazy loaders
  const loadGithubRepos = async () => {
    if (githubFetched) return;
    setGithubLoading(true);
    setGithubError(null);
    try {
      const res = await fetch("/api/github/repos?per_page=100", {
        credentials: "include",
      });
      if (res.status === 400) {
        setGithubError("not_connected");
        return;
      }
      if (res.status === 401) {
        setGithubError("expired");
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGithubRepos(data.repos);
    } catch {
      setGithubError("failed");
    } finally {
      setGithubLoading(false);
      setGithubFetched(true);
    }
  };

  const loadVercelProjects = async () => {
    if (vercelFetched) return;
    setVercelLoading(true);
    setVercelError(null);
    try {
      const res = await fetch("/api/vercel/projects?limit=50", {
        credentials: "include",
      });
      if (res.status === 400) {
        setVercelError("not_connected");
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setVercelProjects(data.projects);
    } catch {
      setVercelError("failed");
    } finally {
      setVercelLoading(false);
      setVercelFetched(true);
    }
  };

  // Selection handlers
  const handleSelectGithubRepo = (repo: GithubRepo) => {
    setSelectedGithubRepo(repo);
    if (!name) setName(repo.name);
  };

  const handleSelectVercel = (vp: VercelProject) => {
    setSelectedVercel(vp);
    if (!name) setName(vp.name);
    // Auto-set GitHub repo if Vercel project has a link and no repo selected
    if (vp.link?.org && vp.link?.repo && !selectedGithubRepo) {
      const fullName = `${vp.link.org}/${vp.link.repo}`;
      setSelectedGithubRepo({
        id: 0,
        fullName,
        name: vp.link.repo,
        owner: vp.link.org,
        private: false,
        defaultBranch: "main",
        url: `https://github.com/${fullName}`,
      });
    }
  };

  // Create new repo
  const handleCreateRepo = async () => {
    const repoName = newRepoName.trim() || name.trim();
    if (!repoName || creatingRepo) return;
    setCreatingRepo(true);
    try {
      const res = await fetch("/api/github/repos", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: repoName,
          private: true,
          templateRepo: selectedTemplate
            ? (TEMPLATES.find((t) => t.id === selectedTemplate)?.repo ??
              undefined)
            : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to create repository");
        return;
      }
      const data = await res.json();
      setSelectedGithubRepo(data.repo);
      if (!name) setName(data.repo.name);
      setShowCreateRepo(false);
      setNewRepoName("");
      toast.success(`Created ${data.repo.fullName}`);
    } catch {
      toast.error("Failed to create repository");
    } finally {
      setCreatingRepo(false);
    }
  };

  // Create new Vercel project
  const handleCreateVercel = async () => {
    const projectName = newVercelName.trim() || name.trim();
    if (!projectName || creatingVercel) return;
    setCreatingVercel(true);
    try {
      const res = await fetch("/api/vercel/projects", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName,
          githubRepo: selectedGithubRepo?.fullName,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to create Vercel project");
        return;
      }
      const data = await res.json();
      setSelectedVercel(data.project);
      if (!name) setName(data.project.name);
      setShowCreateVercel(false);
      setNewVercelName("");
      toast.success(`Created ${data.project.name}`);
    } catch {
      toast.error("Failed to create Vercel project");
    } finally {
      setCreatingVercel(false);
    }
  };

  // Create project
  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);

    try {
      const body: Record<string, string | null> = { name: name.trim() };

      if (selectedTemplate && selectedTemplate !== "bring-your-own") {
        body.templateId = selectedTemplate;
      }
      if (selectedGithubRepo) {
        body.githubRepo = selectedGithubRepo.fullName;
      }
      if (selectedVercel) {
        body.vercelProjectId = selectedVercel.id;
        body.vercelProjectName = selectedVercel.name;
        body.vercelOrgId = selectedVercel.accountId ?? null;
      }

      const res = await fetch("/api/projects", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to create project");
        return;
      }

      navigate("/");
    } catch {
      setError("Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  const canCreate = name.trim().length > 0;

  return (
    <div className="mx-auto max-w-[960px]">
      <div className="mb-8">
        <H3>New Project</H3>
      </div>

      {/* Card 1: Project Name */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Project Name</CardTitle>
          <CardDescription>A unique name for your project.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            id="project-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canCreate && handleCreate()}
            placeholder="my-app"
            className="max-w-md"
            autoFocus
          />
        </CardContent>
      </Card>

      {/* Card 2: Template */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Template</CardTitle>
          <CardDescription>
            Choose a starter template or bring your own project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {TEMPLATES.map((t) => (
              <Item key={t.id} variant="outline">
                <ItemMedia variant="icon">
                  {t.id === "bring-your-own" ? (
                    <FolderOpen className="size-5" />
                  ) : (
                    <ReactRouterIcon />
                  )}
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{t.name}</ItemTitle>
                  <ItemDescription>{t.description}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button
                    size="sm"
                    variant={selectedTemplate === t.id ? "default" : "outline"}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTemplate(
                        selectedTemplate === t.id ? null : t.id,
                      );
                    }}
                  >
                    {selectedTemplate === t.id ? "Selected" : "Use"}
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Card 3: GitHub Repository */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitHubIcon /> GitHub Repository
          </CardTitle>
          <CardDescription>
            Link a source repository for sandbox code and pushing changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!githubConnected ? (
            <Muted>
              GitHub not connected.{" "}
              <Link to="/settings" className="underline">
                Configure in settings
              </Link>{" "}
              to link a repository.
            </Muted>
          ) : selectedGithubRepo ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono">
                {selectedGithubRepo.fullName}
              </Badge>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSelectedGithubRepo(null)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ) : null}
        </CardContent>
        {githubConnected && !selectedGithubRepo && (
          <CardFooter
            className={`border-t ${showCreateRepo ? "justify-end" : "justify-between"}`}
          >
            {!showCreateRepo && <Muted>No repository selected.</Muted>}
            {showCreateRepo ? (
              <div className="flex flex-col gap-3 w-full">
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={newRepoName}
                    onChange={(e) => setNewRepoName(e.target.value)}
                    placeholder={name.trim() || "repository-name"}
                    className="max-w-xs"
                    onKeyDown={(e) => e.key === "Enter" && handleCreateRepo()}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={handleCreateRepo}
                    disabled={creatingRepo}
                  >
                    {creatingRepo ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowCreateRepo(false);
                      setNewRepoName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                <Muted className="text-xs">
                  Creates a private repository
                  {selectedTemplate &&
                  TEMPLATES.find((t) => t.id === selectedTemplate)?.repo
                    ? " from the selected template"
                    : ""}
                  . Leave blank to use the project name.
                </Muted>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <ResourcePicker
                  items={githubRepos}
                  loading={githubLoading}
                  error={githubError}
                  renderItem={(repo) => (
                    <span className="truncate">{repo.fullName}</span>
                  )}
                  getItemValue={(repo) => repo.fullName}
                  getItemKey={(repo) => String(repo.id)}
                  selectedKey={null}
                  onSelect={handleSelectGithubRepo}
                  onOpen={loadGithubRepos}
                  triggerLabel="Select existing"
                  placeholder="Search repositories..."
                  emptyMessage="No repositories found."
                  notConnectedMessage="GitHub token not configured."
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateRepo(true)}
                >
                  <Plus className="size-3.5" />
                  Create new
                </Button>
              </div>
            )}
          </CardFooter>
        )}
      </Card>

      {/* Card 4: Vercel Project */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <VercelIcon /> Vercel Project
          </CardTitle>
          <CardDescription>
            Link a Vercel project for deployments and environment variable sync.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!vercelConnected ? (
            <Muted>
              Vercel not connected.{" "}
              <Link to="/settings" className="underline">
                Configure in settings
              </Link>{" "}
              to link a project.
            </Muted>
          ) : selectedVercel ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{selectedVercel.name}</Badge>
              {selectedVercel.framework && (
                <Muted className="text-xs">{selectedVercel.framework}</Muted>
              )}
              {selectedVercel.link && (
                <Muted className="text-xs">
                  {selectedVercel.link.org}/{selectedVercel.link.repo}
                </Muted>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSelectedVercel(null)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ) : null}
        </CardContent>
        {vercelConnected && !selectedVercel && (
          <CardFooter
            className={`border-t ${showCreateVercel ? "justify-end" : "justify-between"}`}
          >
            {!showCreateVercel && <Muted>No Vercel project selected.</Muted>}
            {showCreateVercel ? (
              <div className="flex flex-col gap-3 w-full">
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={newVercelName}
                    onChange={(e) => setNewVercelName(e.target.value)}
                    placeholder={name.trim() || "project-name"}
                    className="max-w-xs"
                    onKeyDown={(e) => e.key === "Enter" && handleCreateVercel()}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={handleCreateVercel}
                    disabled={creatingVercel}
                  >
                    {creatingVercel ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowCreateVercel(false);
                      setNewVercelName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                <Muted className="text-xs">
                  Creates a new Vercel project.
                  {selectedGithubRepo
                    ? ` Will be linked to ${selectedGithubRepo.fullName}.`
                    : " Leave blank to use the project name."}
                </Muted>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <ResourcePicker
                  items={vercelProjects}
                  loading={vercelLoading}
                  error={vercelError}
                  renderItem={(vp) => (
                    <div className="flex flex-col">
                      <span className="truncate">{vp.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {vp.framework ?? "No framework"}
                        {vp.link
                          ? ` \u00b7 ${vp.link.org}/${vp.link.repo}`
                          : ""}
                      </span>
                    </div>
                  )}
                  getItemValue={(vp) => vp.name}
                  getItemKey={(vp) => vp.id}
                  selectedKey={null}
                  onSelect={handleSelectVercel}
                  onOpen={loadVercelProjects}
                  triggerLabel="Select existing"
                  placeholder="Search projects..."
                  emptyMessage="No Vercel projects found."
                  notConnectedMessage="Vercel token not configured."
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateVercel(true)}
                >
                  <Plus className="size-3.5" />
                  Create new
                </Button>
              </div>
            )}
          </CardFooter>
        )}
      </Card>

      {/* Error */}
      {error && <Small className="mb-4 text-destructive">{error}</Small>}

      {/* Create button */}
      <Button
        onClick={handleCreate}
        disabled={!canCreate || creating}
        className="w-full"
      >
        {creating ? "Creating..." : "Create Project"}
      </Button>
    </div>
  );
}

function ReactRouterIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      className="shrink-0"
    >
      <circle cx="6" cy="18" r="3" fill="currentColor" />
      <circle cx="18" cy="18" r="3" fill="currentColor" />
      <circle cx="12" cy="6" r="3" fill="currentColor" />
      <path
        d="M12 9v3M9 16.5L7.5 15M15 16.5l1.5-1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="shrink-0"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function VercelIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 76 65"
      fill="currentColor"
      className="shrink-0"
    >
      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
  );
}
