import { useState, useEffect, useMemo } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
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

// ---------------------------------------------------------------------------
// Known integration keys — managed by integration cards, hidden from env vars
// ---------------------------------------------------------------------------

const INTEGRATION_KEYS = new Set([
  "GITHUB_TOKEN",
  "GITHUB_ACCESS_TOKEN",
  "VERCEL_TOKEN",
  "VERCEL_ACCESS_TOKEN",
  "CLAUDE_ACCESS_TOKEN",
  "CLAUDE_TOKEN_EXPIRES",
  "CLAUDE_REFRESH_TOKEN",
  "ANTHROPIC_API_KEY",
]);

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Project {
  id: string;
  name: string;
  templateId: string | null;
  vercelProjectId: string | null;
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

export default function ProjectSettings({
  loaderData,
}: {
  loaderData: { project: Project; role: string };
}) {
  const { project, role } = loaderData;
  const isAdmin = role === "admin" || role === "owner";
  const vercelConnected = !!project.vercelProjectId;

  // --- Project name ---
  const [projectName, setProjectName] = useState(project.name);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const nameChanged = projectName.trim() !== project.name;

  // --- Connections ---
  const [connections, setConnections] = useState<ConnectionStatus | null>(null);
  const [connectionsLoading, setConnectionsLoading] = useState(true);

  // --- Per-integration override inputs ---
  const [githubInput, setGithubInput] = useState("");
  const [showGithubInput, setShowGithubInput] = useState(false);
  const [savingGithub, setSavingGithub] = useState(false);

  const [vercelInput, setVercelInput] = useState("");
  const [showVercelInput, setShowVercelInput] = useState(false);
  const [savingVercel, setSavingVercel] = useState(false);

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

  // -----------------------------------------------------------------------
  // Derived — filter integration keys out of the raw secrets lists
  // -----------------------------------------------------------------------

  const filteredProjectSecrets = useMemo(
    () => projectSecrets.filter((s) => !INTEGRATION_KEYS.has(s.key)),
    [projectSecrets],
  );

  const filteredOrgSecrets = useMemo(
    () => orgSecrets.filter((s) => !INTEGRATION_KEYS.has(s.key)),
    [orgSecrets],
  );

  const projectKeySet = useMemo(
    () => new Set(filteredProjectSecrets.map((s) => s.key)),
    [filteredProjectSecrets],
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
  // Handlers — token overrides (GitHub / Vercel via secrets API)
  // -----------------------------------------------------------------------

  const handleSaveToken = async (
    key: string,
    value: string,
    label: string,
    setSavingFn: (v: boolean) => void,
    setInputFn: (v: string) => void,
    setShowFn: (v: boolean) => void,
  ) => {
    if (!value.trim()) return;
    setSavingFn(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/secrets`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: value.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? `Failed to save ${label}`);
        return;
      }
      setInputFn("");
      setShowFn(false);
      toast.success(`Project ${label} saved`);
      await fetchConnections();
    } catch {
      toast.error(`Failed to save ${label}`);
    } finally {
      setSavingFn(false);
    }
  };

  const handleRemoveToken = async (
    key: string,
    label: string,
    setSavingFn: (v: boolean) => void,
    setShowFn: (v: boolean) => void,
  ) => {
    setSavingFn(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/secrets`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!res.ok) {
        toast.error(`Failed to remove ${label} override`);
        return;
      }
      toast.success(`${label} override removed — using org default`);
      setShowFn(false);
      await fetchConnections();
    } catch {
      toast.error(`Failed to remove ${label} override`);
    } finally {
      setSavingFn(false);
    }
  };

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
        prev.map((k) =>
          k.key === key ? { ...k, syncEnabled: !enabled } : k,
        ),
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
            {project.githubRepo ? (
              <>
                Repository{" "}
                <span className="font-mono text-foreground">
                  {project.githubRepo}
                </span>
                . Used for sandbox source code and pushing changes.
              </>
            ) : (
              "Repository access for sandbox source code and pushing changes."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connectionsLoading ? (
            <Muted>Loading...</Muted>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                {connections?.github.tokenAvailable ? (
                  <>
                    <Badge className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
                      Connected
                    </Badge>
                    <Badge>{connections.github.tokenSource ?? "org"}</Badge>
                  </>
                ) : connections?.github.linked ? (
                  <Badge
                    variant="outline"
                    className="border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300"
                  >
                    Linked — no token
                  </Badge>
                ) : (
                  <Muted>Not connected</Muted>
                )}
              </div>

              {showGithubInput && isAdmin && (
                <div className="flex items-center gap-2">
                  <Input
                    type="password"
                    value={githubInput}
                    onChange={(e) => setGithubInput(e.target.value)}
                    placeholder="ghp_... or GitHub access token"
                    className="min-w-0 flex-1 max-w-md"
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        handleSaveToken(
                          "GITHUB_TOKEN",
                          githubInput,
                          "GitHub token",
                          setSavingGithub,
                          setGithubInput,
                          setShowGithubInput,
                        );
                      if (e.key === "Escape") {
                        setShowGithubInput(false);
                        setGithubInput("");
                      }
                    }}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={() =>
                      handleSaveToken(
                        "GITHUB_TOKEN",
                        githubInput,
                        "GitHub token",
                        setSavingGithub,
                        setGithubInput,
                        setShowGithubInput,
                      )
                    }
                    disabled={!githubInput.trim() || savingGithub}
                  >
                    {savingGithub ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowGithubInput(false);
                      setGithubInput("");
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
            {connections?.github.tokenAvailable &&
            connections.github.tokenSource === "project" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleRemoveToken(
                    "GITHUB_TOKEN",
                    "GitHub token",
                    setSavingGithub,
                    setShowGithubInput,
                  )
                }
                disabled={savingGithub}
              >
                Remove override
              </Button>
            ) : !showGithubInput ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowGithubInput(true);
                  setGithubInput("");
                }}
              >
                {connections?.github.tokenAvailable ? "Override" : "Add token"}
              </Button>
            ) : null}
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
            {project.vercelProjectId ? (
              <>
                Vercel project{" "}
                <span className="font-mono text-foreground">
                  {project.vercelProjectId}
                </span>
                . Used for deployments and environment sync.
              </>
            ) : (
              "Deployments and environment variable sync."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connectionsLoading ? (
            <Muted>Loading...</Muted>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                {connections?.vercel.tokenAvailable ? (
                  <>
                    <Badge className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
                      Connected
                    </Badge>
                    <Badge>{connections.vercel.tokenSource ?? "org"}</Badge>
                  </>
                ) : connections?.vercel.linked ? (
                  <Badge
                    variant="outline"
                    className="border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300"
                  >
                    Linked — no token
                  </Badge>
                ) : (
                  <Muted>Not connected</Muted>
                )}
              </div>

              {showVercelInput && isAdmin && (
                <div className="flex items-center gap-2">
                  <Input
                    type="password"
                    value={vercelInput}
                    onChange={(e) => setVercelInput(e.target.value)}
                    placeholder="Vercel access token"
                    className="min-w-0 flex-1 max-w-md"
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        handleSaveToken(
                          "VERCEL_TOKEN",
                          vercelInput,
                          "Vercel token",
                          setSavingVercel,
                          setVercelInput,
                          setShowVercelInput,
                        );
                      if (e.key === "Escape") {
                        setShowVercelInput(false);
                        setVercelInput("");
                      }
                    }}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={() =>
                      handleSaveToken(
                        "VERCEL_TOKEN",
                        vercelInput,
                        "Vercel token",
                        setSavingVercel,
                        setVercelInput,
                        setShowVercelInput,
                      )
                    }
                    disabled={!vercelInput.trim() || savingVercel}
                  >
                    {savingVercel ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowVercelInput(false);
                      setVercelInput("");
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
            {connections?.vercel.tokenAvailable &&
            connections.vercel.tokenSource === "project" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleRemoveToken(
                    "VERCEL_TOKEN",
                    "Vercel token",
                    setSavingVercel,
                    setShowVercelInput,
                  )
                }
                disabled={savingVercel}
              >
                Remove override
              </Button>
            ) : !showVercelInput ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowVercelInput(true);
                  setVercelInput("");
                }}
              >
                {connections?.vercel.tokenAvailable ? "Override" : "Add token"}
              </Button>
            ) : null}
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
            <div className="flex items-center gap-2">
              {vercelConnected && (
                <Badge variant="outline" className="gap-1.5">
                  <VercelIcon /> Vercel
                </Badge>
              )}
              <Button
                size="sm"
                variant={vercelConnected ? "default" : "outline"}
                onClick={handleBulkSync}
                disabled={!vercelConnected || !isAdmin || syncing}
              >
                <VercelIcon />
                {syncing ? "Syncing..." : "Sync to Vercel"}
              </Button>
            </div>
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
                secrets={filteredProjectSecrets}
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
                secrets={filteredOrgSecrets}
                overriddenKeys={projectKeySet}
                isAdmin={isAdmin}
                syncMap={syncMap}
                vercelConnected={vercelConnected}
                onToggleSync={handleToggleSync}
              />
            </div>
          )}
        </CardContent>

        {project.vercelProjectId && (
          <CardFooter className="border-t">
            <Badge variant="outline" className="gap-1.5">
              <VercelIcon /> Syncs to Vercel
            </Badge>
          </CardFooter>
        )}
      </Card>
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
                  className={`w-50 shrink-0 font-mono text-[0.8125rem] font-medium ${
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
                  disabled={
                    !vercelConnected || isDenylisted || !isAdmin
                  }
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
