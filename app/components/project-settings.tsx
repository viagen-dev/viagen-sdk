import { useState, useEffect, useMemo } from "react";
import { useRouteLoaderData, useNavigate } from "react-router";
import { Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Switch } from "~/components/ui/switch";
import { Small, Muted } from "~/components/ui/typography";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { ResourcePicker } from "~/components/resource-picker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Project {
  id: string;
  name: string;
  templateId: string | null;
  vercelProjectId: string | null;
  vercelProjectName: string | null;
  githubRepo: string | null;
  vercelEnvSync: Record<string, boolean> | null;
  createdAt: string;
  updatedAt: string;
}

interface VercelSyncKey {
  key: string;
  syncEnabled: boolean;
  isDenylisted: boolean;
}

interface SecretEntry {
  key: string;
  value: string;
}

interface GithubRepo {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
  url: string;
}

interface VercelProjectItem {
  id: string;
  name: string;
  framework: string | null;
  accountId?: string;
  link?: { type: string; org: string; repo: string };
}

interface AuthLoaderData {
  integrations: { github: boolean; vercel: boolean; claude: boolean };
}

interface ConnectionStatus {
  github: {
    linked: boolean;
    tokenAvailable: boolean;
    tokenSource: "project" | "org" | null;
  };
  vercel: {
    linked: boolean;
    tokenAvailable: boolean;
    tokenSource: "project" | "org" | null;
  };
  claude: {
    connected: boolean;
    source: string | null;
    keyPrefix: string | null;
    expired: boolean;
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectSettingsPanel({
  project,
  role,
}: {
  project: Project;
  role: string;
}) {
  const isAdmin = role === "admin" || role === "owner";
  const parentData = useRouteLoaderData("routes/_auth") as
    | AuthLoaderData
    | undefined;
  const githubIntegration = parentData?.integrations.github ?? false;
  const vercelIntegration = parentData?.integrations.vercel ?? false;

  // --- Optimistic overrides for GitHub/Vercel linkage ---
  const [localGithubRepo, setLocalGithubRepo] = useState<string | undefined>(
    undefined,
  );
  const [localVercelProjectId, setLocalVercelProjectId] = useState<
    string | undefined
  >(undefined);
  const [localVercelProjectName, setLocalVercelProjectName] = useState<
    string | undefined
  >(undefined);

  const effectiveGithubRepo = localGithubRepo ?? project.githubRepo;
  const effectiveVercelProjectId =
    localVercelProjectId ?? project.vercelProjectId;
  const vercelConnected = !!effectiveVercelProjectId;

  // --- GitHub picker state ---
  const [githubRepos, setGithubRepos] = useState<GithubRepo[]>([]);
  const [githubReposLoading, setGithubReposLoading] = useState(false);
  const [githubReposError, setGithubReposError] = useState<string | null>(null);
  const [githubReposFetched, setGithubReposFetched] = useState(false);
  const [savingGithub, setSavingGithub] = useState(false);

  // --- Vercel picker state ---
  const [vercelProjects, setVercelProjects] = useState<VercelProjectItem[]>([]);
  const [vercelProjectsLoading, setVercelProjectsLoading] = useState(false);
  const [vercelProjectsError, setVercelProjectsError] = useState<string | null>(
    null,
  );
  const [vercelProjectsFetched, setVercelProjectsFetched] = useState(false);
  const [savingVercel, setSavingVercel] = useState(false);

  // --- Project name ---
  const [projectName, setProjectName] = useState(project.name);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const nameChanged = projectName.trim() !== project.name;

  // --- Connections ---
  const [connections, setConnections] = useState<ConnectionStatus | null>(null);
  const [connectionsLoading, setConnectionsLoading] = useState(true);

  const [claudeInput, setClaudeInput] = useState("");
  const [showClaudeInput, setShowClaudeInput] = useState(false);
  const [savingClaude, setSavingClaude] = useState(false);

  // --- Secrets ---
  const [projectSecrets, setProjectSecrets] = useState<SecretEntry[]>([]);
  const [orgSecrets, setOrgSecrets] = useState<SecretEntry[]>([]);
  const [secretsLoading, setSecretsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Vercel sync state
  const [syncKeys, setSyncKeys] = useState<VercelSyncKey[]>([]);
  const [syncing, setSyncing] = useState(false);

  // Build a lookup map: key → { syncEnabled, isDenylisted }
  const syncMap = useMemo(() => {
    const map = new Map<string, VercelSyncKey>();
    for (const sk of syncKeys) map.set(sk.key, sk);
    return map;
  }, [syncKeys]);

  const projectKeySet = useMemo(
    () => new Set(projectSecrets.map((s) => s.key)),
    [projectSecrets],
  );

  // -----------------------------------------------------------------------
  // Handlers — project name
  // -----------------------------------------------------------------------

  const handleSaveName = async () => {
    if (!projectName.trim() || savingName) return;
    setSavingName(true);
    setNameError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setNameError(data.error ?? "Failed to update name");
        return;
      }
      setNameSaved(true);
      toast.success("Project name updated");
    } catch {
      setNameError("Failed to update name");
    } finally {
      setSavingName(false);
    }
  };

  // -----------------------------------------------------------------------
  // Handlers — fetch data
  // -----------------------------------------------------------------------

  const fetchConnections = async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/status`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setConnections(data);
      }
    } catch {
      // silently fail
    } finally {
      setConnectionsLoading(false);
    }
  };

  const fetchSecrets = async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/secrets`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load secrets");
      const data = await res.json();
      setProjectSecrets(data.project ?? []);
      setOrgSecrets(data.org ?? []);
    } catch {
      setError("Failed to load secrets");
    } finally {
      setSecretsLoading(false);
    }
  };

  // Fetch vercel sync state
  const fetchSyncState = async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/vercel-sync`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      setSyncKeys(data.keys ?? []);
    } catch {
      // non-critical — switches just won't have state
    }
  };

  useEffect(() => {
    fetchConnections();
    fetchSecrets();
    fetchSyncState();
  }, [project.id]);

  // -----------------------------------------------------------------------
  // Handlers — Claude override (dedicated endpoint)
  // -----------------------------------------------------------------------

  const handleSaveClaude = async () => {
    if (!claudeInput.trim() || savingClaude) return;
    setSavingClaude(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/claude`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: claudeInput.trim(),
          scope: "project",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to save Claude key");
        return;
      }
      setClaudeInput("");
      setShowClaudeInput(false);
      toast.success("Project Claude key saved");
      await fetchConnections();
    } catch {
      toast.error("Failed to save Claude key");
    } finally {
      setSavingClaude(false);
    }
  };

  const handleRemoveClaude = async () => {
    setSavingClaude(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/claude`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        toast.error("Failed to remove Claude override");
        return;
      }
      toast.success("Claude override removed — using org default");
      setShowClaudeInput(false);
      await fetchConnections();
    } catch {
      toast.error("Failed to remove Claude override");
    } finally {
      setSavingClaude(false);
    }
  };

  // -----------------------------------------------------------------------
  // Handlers — GitHub/Vercel pickers
  // -----------------------------------------------------------------------

  const loadGithubRepos = async () => {
    if (githubReposFetched) return;
    setGithubReposLoading(true);
    setGithubReposError(null);
    try {
      const res = await fetch("/api/github/repos?per_page=100", {
        credentials: "include",
      });
      if (res.status === 400) {
        setGithubReposError("not_connected");
        return;
      }
      if (res.status === 401) {
        setGithubReposError("expired");
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGithubRepos(data.repos);
    } catch {
      setGithubReposError("failed");
    } finally {
      setGithubReposLoading(false);
      setGithubReposFetched(true);
    }
  };

  const loadVercelProjects = async () => {
    if (vercelProjectsFetched) return;
    setVercelProjectsLoading(true);
    setVercelProjectsError(null);
    try {
      const res = await fetch("/api/vercel/projects?limit=50", {
        credentials: "include",
      });
      if (res.status === 400) {
        setVercelProjectsError("not_connected");
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setVercelProjects(data.projects);
    } catch {
      setVercelProjectsError("failed");
    } finally {
      setVercelProjectsLoading(false);
      setVercelProjectsFetched(true);
    }
  };

  const handleChangeGithubRepo = async (repo: GithubRepo) => {
    setSavingGithub(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubRepo: repo.fullName }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to update GitHub repository");
        return;
      }
      setLocalGithubRepo(repo.fullName);
      toast.success("GitHub repository updated");
    } catch {
      toast.error("Failed to update GitHub repository");
    } finally {
      setSavingGithub(false);
    }
  };

  const handleChangeVercelProject = async (vp: VercelProjectItem) => {
    setSavingVercel(true);
    try {
      const body: Record<string, string | null> = {
        vercelProjectId: vp.id,
        vercelProjectName: vp.name,
        vercelOrgId: vp.accountId ?? null,
      };
      // Auto-set GitHub repo if Vercel project has a link and no repo linked
      if (vp.link?.org && vp.link?.repo && !effectiveGithubRepo) {
        body.githubRepo = `${vp.link.org}/${vp.link.repo}`;
      }
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to update Vercel project");
        return;
      }
      setLocalVercelProjectId(vp.id);
      setLocalVercelProjectName(vp.name);
      if (body.githubRepo) {
        setLocalGithubRepo(body.githubRepo);
        toast.success("Vercel project and GitHub repository updated");
      } else {
        toast.success("Vercel project updated");
      }
    } catch {
      toast.error("Failed to update Vercel project");
    } finally {
      setSavingVercel(false);
    }
  };

  // Vercel sync handlers
  const handleToggleSync = async (key: string, enabled: boolean) => {
    // Optimistic update
    setSyncKeys((prev) =>
      prev.map((k) => (k.key === key ? { ...k, syncEnabled: enabled } : k)),
    );
    try {
      const res = await fetch(`/api/projects/${project.id}/vercel-sync`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to update sync config");
        // Revert
        setSyncKeys((prev) =>
          prev.map((k) =>
            k.key === key ? { ...k, syncEnabled: !enabled } : k,
          ),
        );
      }
    } catch {
      toast.error("Failed to update sync config");
      setSyncKeys((prev) =>
        prev.map((k) => (k.key === key ? { ...k, syncEnabled: !enabled } : k)),
      );
    }
  };

  const handleBulkSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/vercel-sync`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Sync failed");
        return;
      }
      toast.success(
        `Synced ${data.synced} keys to Vercel (${data.skipped} skipped, ${data.denylisted} blocked)`,
      );
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  // -----------------------------------------------------------------------
  // Handlers — delete project
  // -----------------------------------------------------------------------

  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [deleteGithub, setDeleteGithub] = useState(true);
  const [deleteVercelPrj, setDeleteVercelPrj] = useState(true);
  const [confirmText, setConfirmText] = useState("");

  const canDelete = confirmText === project.name;

  const handleDeleteProject = async () => {
    if (!canDelete || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deleteGithubRepo: deleteGithub && !!effectiveGithubRepo,
          deleteVercelProject: deleteVercelPrj && !!effectiveVercelProjectId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to delete project");
        return;
      }
      const data = await res.json();
      if (data.warnings?.length) {
        for (const w of data.warnings) toast.warning(w);
      }
      toast.success("Project deleted");
      navigate("/");
    } catch {
      toast.error("Failed to delete project");
    } finally {
      setDeleting(false);
    }
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-6">
      {/* ================================================================= */}
      {/* Project Name                                                      */}
      {/* ================================================================= */}
      <Card>
        <CardHeader>
          <CardTitle>Project Name</CardTitle>
          <CardDescription>The display name for this project.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            type="text"
            value={projectName}
            onChange={(e) => {
              setProjectName(e.target.value);
              setNameSaved(false);
              setNameError(null);
            }}
            placeholder="Project name"
            className="max-w-md"
            onKeyDown={(e) =>
              e.key === "Enter" && nameChanged && handleSaveName()
            }
          />
          {nameError && (
            <p className="mt-2 text-sm text-destructive">{nameError}</p>
          )}
        </CardContent>
        <CardFooter className="border-t justify-between">
          <div className="flex items-center gap-4">
            {project.templateId && (
              <Muted>
                Template:{" "}
                <span className="font-medium text-foreground">
                  {project.templateId}
                </span>
              </Muted>
            )}
            <Muted>
              Created {new Date(project.createdAt).toLocaleDateString()}
            </Muted>
          </div>
          <Button
            onClick={handleSaveName}
            disabled={!nameChanged || !projectName.trim() || savingName}
          >
            {savingName ? "Saving..." : nameSaved ? "Saved" : "Save"}
          </Button>
        </CardFooter>
      </Card>

      {/* ================================================================= */}
      {/* GitHub                                                            */}
      {/* ================================================================= */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitHubIcon /> GitHub
          </CardTitle>
          <CardDescription>
            Source repository for sandbox code and pushing changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {effectiveGithubRepo ? (
            <div className="flex items-center gap-2">
              <Badge className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
                Linked
              </Badge>
              <span className="font-mono text-sm">{effectiveGithubRepo}</span>
            </div>
          ) : (
            <Muted>No repository linked.</Muted>
          )}
        </CardContent>
        {isAdmin && (
          <CardFooter className="border-t justify-end">
            {githubIntegration ? (
              <ResourcePicker
                items={githubRepos}
                loading={githubReposLoading}
                error={githubReposError}
                renderItem={(repo) => (
                  <span className="truncate">{repo.fullName}</span>
                )}
                getItemValue={(repo) => repo.fullName}
                getItemKey={(repo) => String(repo.id)}
                selectedKey={null}
                onSelect={handleChangeGithubRepo}
                onOpen={loadGithubRepos}
                triggerLabel={
                  effectiveGithubRepo ? "Change" : "Link repository"
                }
                disabled={savingGithub}
                placeholder="Search repositories..."
                emptyMessage="No repositories found."
                notConnectedMessage="GitHub token not configured."
              />
            ) : (
              <Muted className="text-xs">
                Connect GitHub in org settings to link a repository.
              </Muted>
            )}
          </CardFooter>
        )}
      </Card>

      {/* ================================================================= */}
      {/* Vercel                                                            */}
      {/* ================================================================= */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <VercelIcon /> Vercel
          </CardTitle>
          <CardDescription>
            Deployments and environment variable sync.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {effectiveVercelProjectId ? (
            <div className="flex items-center gap-2">
              <Badge className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
                Linked
              </Badge>
              <span className="font-mono text-sm">
                {localVercelProjectName ?? project.vercelProjectName ?? effectiveVercelProjectId}
              </span>
            </div>
          ) : (
            <Muted>No Vercel project linked.</Muted>
          )}
        </CardContent>
        {isAdmin && (
          <CardFooter className="border-t justify-end">
            {vercelIntegration ? (
              <ResourcePicker
                items={vercelProjects}
                loading={vercelProjectsLoading}
                error={vercelProjectsError}
                renderItem={(vp) => (
                  <div className="flex flex-col">
                    <span className="truncate">{vp.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {vp.framework ?? "No framework"}
                      {vp.link ? ` \u00b7 ${vp.link.org}/${vp.link.repo}` : ""}
                    </span>
                  </div>
                )}
                getItemValue={(vp) => vp.name}
                getItemKey={(vp) => vp.id}
                selectedKey={effectiveVercelProjectId}
                onSelect={handleChangeVercelProject}
                onOpen={loadVercelProjects}
                triggerLabel={
                  effectiveVercelProjectId ? "Change" : "Link project"
                }
                disabled={savingVercel}
                placeholder="Search projects..."
                emptyMessage="No Vercel projects found."
                notConnectedMessage="Vercel token not configured."
              />
            ) : (
              <Muted className="text-xs">
                Connect Vercel in org settings to link a project.
              </Muted>
            )}
          </CardFooter>
        )}
      </Card>

      {/* ================================================================= */}
      {/* Claude                                                            */}
      {/* ================================================================= */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4" /> Claude
          </CardTitle>
          <CardDescription>
            Anthropic API key for AI agent tasks. Used to power sandbox
            sessions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connectionsLoading ? (
            <Muted>Loading...</Muted>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                {connections?.claude.connected ? (
                  <>
                    {connections.claude.expired ? (
                      <Badge
                        variant="outline"
                        className="border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
                      >
                        Expired
                      </Badge>
                    ) : (
                      <Badge className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
                        Connected
                      </Badge>
                    )}
                    <Badge>{connections.claude.source ?? "org"}</Badge>
                    {connections.claude.keyPrefix && (
                      <Muted className="font-mono text-xs">
                        {connections.claude.keyPrefix}
                      </Muted>
                    )}
                  </>
                ) : (
                  <Muted>Not connected</Muted>
                )}
              </div>

              {showClaudeInput && isAdmin && (
                <div className="flex items-center gap-2">
                  <Input
                    type="password"
                    value={claudeInput}
                    onChange={(e) => setClaudeInput(e.target.value)}
                    placeholder="sk-ant-api..."
                    className="min-w-0 flex-1 max-w-md"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveClaude();
                      if (e.key === "Escape") {
                        setShowClaudeInput(false);
                        setClaudeInput("");
                      }
                    }}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveClaude}
                    disabled={!claudeInput.trim() || savingClaude}
                  >
                    {savingClaude ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowClaudeInput(false);
                      setClaudeInput("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
        {isAdmin && !connectionsLoading && (
          <CardFooter className="border-t justify-end">
            {connections?.claude.connected &&
            connections.claude.source === "project" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemoveClaude}
                disabled={savingClaude}
              >
                Remove override
              </Button>
            ) : !showClaudeInput ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowClaudeInput(true);
                  setClaudeInput("");
                }}
              >
                {connections?.claude.connected ? "Override" : "Add key"}
              </Button>
            ) : null}
          </CardFooter>
        )}
      </Card>

      {/* ================================================================= */}
      {/* Environment Variables                                             */}
      {/* ================================================================= */}
      <Card>
        <CardHeader>
          <CardTitle>Environment Variables</CardTitle>
          <CardDescription>
            Configuration values available to this project.
            {project.vercelProjectId &&
              " Changes sync automatically to Vercel."}
          </CardDescription>
          <CardAction>
            <Button
              size="sm"
              variant={vercelConnected ? "default" : "outline"}
              onClick={handleBulkSync}
              disabled={!vercelConnected || !isAdmin || syncing}
            >
              <VercelIcon />
              {syncing ? "Syncing..." : "Sync to Vercel"}
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {secretsLoading ? (
            <Muted className="py-4">Loading...</Muted>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Project-level env vars */}
              <SecretSection
                title="Project"
                badge={<Badge variant="secondary">project</Badge>}
                secrets={projectSecrets}
                overriddenKeys={new Set()}
                isAdmin={isAdmin}
                syncMap={syncMap}
                vercelConnected={vercelConnected}
                onToggleSync={handleToggleSync}
              />

              {/* Org-level inherited env vars */}
              <SecretSection
                title="Organization"
                badge={
                  <Badge
                    variant="outline"
                    className="border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300"
                  >
                    inherited
                  </Badge>
                }
                secrets={orgSecrets}
                overriddenKeys={projectKeySet}
                isAdmin={isAdmin}
                syncMap={syncMap}
                vercelConnected={vercelConnected}
                onToggleSync={handleToggleSync}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================================================================= */}
      {/* Danger Zone                                                       */}
      {/* ================================================================= */}
      {isAdmin && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <TriangleAlert className="size-4" /> Danger Zone
            </CardTitle>
            <CardDescription>
              Permanently delete this project and optionally its linked GitHub
              repository and Vercel project. This action cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardFooter className="border-t border-destructive/30 justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Delete Project</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {project.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the project from Viagen.
                    {(effectiveGithubRepo || effectiveVercelProjectId) &&
                      " You can also delete the linked external resources."}
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="flex flex-col gap-3 py-2">
                  {effectiveGithubRepo && (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={deleteGithub}
                        onChange={(e) => setDeleteGithub(e.target.checked)}
                        className="size-4 rounded border-border accent-destructive"
                      />
                      <span>
                        Delete GitHub repo{" "}
                        <span className="font-mono text-muted-foreground">
                          {effectiveGithubRepo}
                        </span>
                      </span>
                    </label>
                  )}
                  {effectiveVercelProjectId && (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={deleteVercelPrj}
                        onChange={(e) => setDeleteVercelPrj(e.target.checked)}
                        className="size-4 rounded border-border accent-destructive"
                      />
                      <span>
                        Delete Vercel project{" "}
                        <span className="font-mono text-muted-foreground">
                          {localVercelProjectName ?? project.vercelProjectName ?? effectiveVercelProjectId}
                        </span>
                      </span>
                    </label>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Small>
                    Type{" "}
                    <span className="font-mono font-bold">{project.name}</span>{" "}
                    to confirm
                  </Small>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={project.name}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    onKeyDown={(e) =>
                      e.key === "Enter" && canDelete && handleDeleteProject()
                    }
                    autoComplete="off"
                  />
                </div>

                <AlertDialogFooter>
                  <AlertDialogCancel
                    onClick={() => {
                      setConfirmText("");
                      setDeleteGithub(true);
                      setDeleteVercelPrj(true);
                    }}
                  >
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={!canDelete || deleting}
                    onClick={(e) => {
                      e.preventDefault();
                      handleDeleteProject();
                    }}
                  >
                    {deleting ? "Deleting..." : "Delete everything"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SecretSection — read-only scoped list of secrets (values always obfuscated)
// ---------------------------------------------------------------------------

function SecretSection({
  title,
  badge,
  secrets,
  overriddenKeys,
  isAdmin,
  syncMap,
  vercelConnected,
  onToggleSync,
}: {
  title: string;
  badge: React.ReactNode;
  secrets: SecretEntry[];
  overriddenKeys: Set<string>;
  isAdmin: boolean;
  syncMap: Map<string, VercelSyncKey>;
  vercelConnected: boolean;
  onToggleSync: (key: string, enabled: boolean) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Small className="text-muted-foreground">{title}</Small>
        {badge}
      </div>
      {secrets.length === 0 ? (
        <Muted className="py-2">No {title.toLowerCase()} variables.</Muted>
      ) : (
        <div className="flex flex-col">
          {secrets.map((secret) => {
            const isOverridden = overriddenKeys.has(secret.key);
            const sync = syncMap.get(secret.key);
            const isDenylisted = sync?.isDenylisted ?? false;
            const syncEnabled = sync?.syncEnabled ?? true;
            return (
              <div
                key={secret.key}
                className={`flex items-center gap-3 border-b border-border/50 py-2.5 last:border-b-0 ${
                  isOverridden ? "opacity-50" : ""
                }`}
              >
                <span
                  className={`w-72 shrink-0 font-mono text-[0.8125rem] font-medium ${
                    isOverridden ? "line-through" : ""
                  }`}
                >
                  {secret.key}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[0.8125rem] text-muted-foreground">
                  {secret.value}
                </span>
                <Switch
                  checked={!isDenylisted && syncEnabled}
                  onCheckedChange={(checked) =>
                    onToggleSync(secret.key, checked)
                  }
                  disabled={!vercelConnected || isDenylisted || !isAdmin}
                  size="sm"
                  title={
                    isDenylisted
                      ? "System variable — blocked from Vercel"
                      : !vercelConnected
                        ? "Connect Vercel to enable sync"
                        : syncEnabled
                          ? "Syncs to Vercel"
                          : "Not syncing to Vercel"
                  }
                />
                {isOverridden && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    overridden
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

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
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="shrink-0"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
