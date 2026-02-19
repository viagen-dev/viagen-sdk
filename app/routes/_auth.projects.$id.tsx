import { useState, useEffect } from "react";
import { Link } from "react-router";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";

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
      and(eq(projects.id, params.id), eq(projects.organizationId, org.id))
    );

  if (!project) {
    throw Response.json({ error: "Project not found" }, { status: 404 });
  }

  return { project, role };
}

interface Project {
  id: string;
  name: string;
  templateId: string | null;
  vercelProjectId: string | null;
  githubRepo: string | null;
  gitBranch: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ClaudeStatus {
  connected: boolean;
  source?: "project" | "org" | "user";
  keyPrefix?: string;
}

interface SecretRow {
  key: string;
  value: string;
  source: "project" | "org";
}

const SOURCE_LABELS: Record<string, string> = {
  project: "project key",
  org: "org key",
  user: "personal key",
};

export default function ProjectDetail({
  loaderData,
}: {
  loaderData: { project: Project; role: string };
}) {
  const { project, role } = loaderData;
  const isAdmin = role === "admin";

  // Claude status
  const [claudeStatus, setClaudeStatus] = useState<ClaudeStatus | null>(null);

  // Sandbox
  const [launching, setLaunching] = useState(false);
  const [sandboxUrl, setSandboxUrl] = useState<string | null>(null);
  const [sandboxError, setSandboxError] = useState<string | null>(null);

  // Secrets
  const [secrets, setSecrets] = useState<SecretRow[]>([]);
  const [secretsLoading, setSecretsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Reveal state
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());

  // Fetch Claude status
  useEffect(() => {
    fetch(`/api/projects/${project.id}/claude`, { credentials: "include" })
      .then((r) => r.json())
      .then(setClaudeStatus)
      .catch(() => setClaudeStatus({ connected: false }));
  }, [project.id]);

  // Fetch secrets
  const fetchSecrets = async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/secrets`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load secrets");
      const data = await res.json();
      setSecrets(data.secrets);
    } catch {
      setError("Failed to load secrets");
    } finally {
      setSecretsLoading(false);
    }
  };

  useEffect(() => {
    fetchSecrets();
  }, [project.id]);

  // Launch sandbox
  const handleLaunch = async () => {
    setLaunching(true);
    setSandboxError(null);
    setSandboxUrl(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/sandbox`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setSandboxError(data.error ?? "Failed to launch sandbox");
        return;
      }
      setSandboxUrl(data.url);
    } catch {
      setSandboxError("Failed to launch sandbox");
    } finally {
      setLaunching(false);
    }
  };

  // Secret handlers
  const handleAdd = async () => {
    if (!newKey.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/secrets`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: newKey.trim(), value: newValue }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to save secret");
        setSaving(false);
        return;
      }
      setNewKey("");
      setNewValue("");
      await fetchSecrets();
    } catch {
      setError("Failed to save secret");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (key: string) => {
    if (editSaving) return;
    setEditSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/secrets`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: editValue }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to update secret");
        setEditSaving(false);
        return;
      }
      setEditingKey(null);
      setEditValue("");
      await fetchSecrets();
    } catch {
      setError("Failed to update secret");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (key: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/secrets`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete secret");
        return;
      }
      await fetchSecrets();
    } catch {
      setError("Failed to delete secret");
    }
  };

  const toggleReveal = (key: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const startEdit = (secret: SecretRow) => {
    setEditingKey(secret.key);
    setEditValue(secret.value);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
  };

  const maskValue = (value: string) => {
    if (value.length <= 4) return "\u2022".repeat(8);
    return (
      value.slice(0, 4) + "\u2022".repeat(Math.min(value.length - 4, 20))
    );
  };

  return (
    <div>
      <Link
        to="/projects"
        className="mb-6 inline-block text-sm text-muted-foreground no-underline hover:text-foreground"
      >
        &larr; Projects
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <h1 className="text-3xl font-semibold">{project.name}</h1>
        <button
          onClick={handleLaunch}
          disabled={launching}
          className="inline-flex cursor-pointer items-center whitespace-nowrap rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:bg-primary/90 disabled:opacity-60"
        >
          {launching ? "Launching..." : "Launch Sandbox"}
        </button>
      </div>

      {sandboxUrl && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3.5 py-2.5 text-[0.8125rem] text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
          Sandbox ready:{" "}
          <a
            href={sandboxUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-green-800 dark:text-green-300"
          >
            Open sandbox
          </a>
        </div>
      )}
      {sandboxError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-[0.8125rem] text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          {sandboxError}
        </div>
      )}

      {/* Project details */}
      <div className="mb-6 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
        {project.templateId && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-4">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Template
            </span>
            <span className="flex items-center gap-1.5 text-sm font-medium">
              {project.templateId}
            </span>
          </div>
        )}
        {project.githubRepo && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-4">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Repository
            </span>
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <GitHubIcon /> {project.githubRepo}
            </span>
          </div>
        )}
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Branch
          </span>
          <span className="flex items-center gap-1.5 text-sm font-medium">
            {project.gitBranch ?? "main"}
          </span>
        </div>
        {project.vercelProjectId && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-4">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Vercel
            </span>
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <VercelIcon /> {project.vercelProjectId}
            </span>
          </div>
        )}
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Claude
          </span>
          <span className="flex items-center gap-1.5 text-sm font-medium">
            {claudeStatus === null ? (
              <span className="text-muted-foreground">Checking...</span>
            ) : claudeStatus.connected ? (
              <span className="inline-block rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
                {SOURCE_LABELS[claudeStatus.source ?? "project"]}
                {claudeStatus.keyPrefix
                  ? ` (${claudeStatus.keyPrefix})`
                  : ""}
              </span>
            ) : (
              <span className="inline-block rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Not connected
              </span>
            )}
          </span>
        </div>
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Created
          </span>
          <span className="flex items-center gap-1.5 text-sm font-medium">
            {new Date(project.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Secrets section */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Environment Variables</h2>
          {project.vercelProjectId && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <VercelIcon /> Syncs to Vercel
            </span>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-[0.8125rem] text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Add form */}
        {isAdmin && (
          <div className="mb-4 flex items-center gap-2 border-b border-border pb-4">
            <input
              type="text"
              value={newKey}
              onChange={(e) =>
                setNewKey(
                  e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "")
                )
              }
              placeholder="KEY_NAME"
              className="w-[200px] shrink-0 rounded-md border border-input bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="value"
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <button
              onClick={handleAdd}
              disabled={!newKey.trim() || saving}
              className="cursor-pointer whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Add"}
            </button>
          </div>
        )}

        {/* Secrets list */}
        {secretsLoading ? (
          <p className="py-4 text-sm text-muted-foreground">Loading...</p>
        ) : secrets.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No environment variables set.
          </p>
        ) : (
          <div className="flex flex-col">
            {secrets.map((secret) => (
              <div
                key={secret.key}
                className="flex items-center gap-3 border-b border-border/50 py-2.5 last:border-b-0"
              >
                {editingKey === secret.key ? (
                  <>
                    <span className="w-[200px] shrink-0 font-mono text-[0.8125rem] font-medium">
                      {secret.key}
                    </span>
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleEdit(secret.key);
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                      <button
                        onClick={() => handleEdit(secret.key)}
                        disabled={editSaving}
                        className="cursor-pointer whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:bg-primary/90"
                      >
                        {editSaving ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="cursor-pointer whitespace-nowrap rounded-md border border-input bg-transparent px-4 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-accent"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="w-[200px] shrink-0 font-mono text-[0.8125rem] font-medium">
                      {secret.key}
                    </span>
                    <span
                      className="min-w-0 flex-1 cursor-pointer truncate font-mono text-[0.8125rem] text-muted-foreground"
                      onClick={() => toggleReveal(secret.key)}
                      title="Click to reveal"
                    >
                      {revealedKeys.has(secret.key)
                        ? secret.value
                        : maskValue(secret.value)}
                    </span>
                    <span
                      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[0.6875rem] font-medium ${
                        secret.source === "org"
                          ? "border border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300"
                          : "border border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      {secret.source === "org" ? "inherited" : "project"}
                    </span>
                    {isAdmin && secret.source === "project" && (
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => startEdit(secret)}
                          className="cursor-pointer border-none bg-transparent px-2 py-1 text-[0.8125rem] text-muted-foreground hover:text-foreground"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(secret.key)}
                          className="cursor-pointer border-none bg-transparent px-2 py-1 text-[0.8125rem] text-destructive hover:text-destructive/80"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                    {secret.source === "org" && isAdmin && (
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => {
                            setNewKey(secret.key);
                            setNewValue("");
                          }}
                          className="cursor-pointer border-none bg-transparent px-2 py-1 text-[0.8125rem] text-muted-foreground hover:text-foreground"
                          title="Create a project-level override"
                        >
                          Override
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
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
