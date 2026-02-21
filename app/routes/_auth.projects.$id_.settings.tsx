import { useState, useEffect } from "react";
import { Link } from "react-router";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";

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
  templateId: string | null;
  vercelProjectId: string | null;
  githubRepo: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SecretRow {
  key: string;
  value: string;
  source: "project" | "org";
}

export default function ProjectDetail({
  loaderData,
}: {
  loaderData: { project: Project; role: string };
}) {
  const { project, role } = loaderData;
  const isAdmin = role === "admin";

  // Project name
  const [projectName, setProjectName] = useState(project.name);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const nameChanged = projectName.trim() !== project.name;

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

  // Save project name
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
    } catch {
      setNameError("Failed to update name");
    } finally {
      setSavingName(false);
    }
  };

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
    return value.slice(0, 4) + "\u2022".repeat(Math.min(value.length - 4, 20));
  };

  return (
    <div>
      <Button
        variant="link"
        asChild
        className="mb-6 h-auto p-0 text-muted-foreground"
      >
        <Link to={`/projects/${project.id}`}>&larr; Back to tasks</Link>
      </Button>

      {/* Header */}
      <div className="mb-6">
        <h2 className="mb-4 text-lg font-semibold">Project Name</h2>
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <Input
                type="text"
                value={projectName}
                onChange={(e) => {
                  setProjectName(e.target.value);
                  setNameSaved(false);
                  setNameError(null);
                }}
                placeholder="Project name"
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && nameChanged && handleSaveName()}
              />
              <Button
                onClick={handleSaveName}
                disabled={!nameChanged || !projectName.trim() || savingName}
              >
                {savingName ? "Saving..." : nameSaved ? "Saved" : "Save"}
              </Button>
            </div>
            {nameError && (
              <p className="mt-2 text-sm text-destructive">{nameError}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Project details */}
      <div className="mb-6 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
        {project.templateId && (
          <Card>
            <CardContent className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Template
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {project.templateId}
              </span>
            </CardContent>
          </Card>
        )}
        {project.githubRepo && (
          <Card>
            <CardContent className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Repository
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <GitHubIcon /> {project.githubRepo}
              </span>
            </CardContent>
          </Card>
        )}
        {project.vercelProjectId && (
          <Card>
            <CardContent className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Vercel
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <VercelIcon /> {project.vercelProjectId}
              </span>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Created
            </span>
            <span className="flex items-center gap-1.5 text-sm font-medium">
              {new Date(project.createdAt).toLocaleDateString()}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Secrets section */}
      <Card>
        <CardHeader>
          <CardTitle>Environment Variables</CardTitle>
          {project.vercelProjectId && (
            <CardAction>
              <Badge variant="outline" className="gap-1.5">
                <VercelIcon /> Syncs to Vercel
              </Badge>
            </CardAction>
          )}
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Add form */}
          {isAdmin && (
            <div className="mb-4 flex items-center gap-2 border-b border-border pb-4">
              <Input
                type="text"
                value={newKey}
                onChange={(e) =>
                  setNewKey(
                    e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""),
                  )
                }
                placeholder="KEY_NAME"
                className="w-[200px] shrink-0 font-mono"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <Input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="value"
                className="min-w-0 flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <Button
                onClick={handleAdd}
                disabled={!newKey.trim() || saving}
                size="sm"
              >
                {saving ? "Saving..." : "Add"}
              </Button>
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
                        <Input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="min-w-0 flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleEdit(secret.key);
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleEdit(secret.key)}
                          disabled={editSaving}
                        >
                          {editSaving ? "Saving..." : "Save"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </Button>
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
                      <Badge
                        variant={
                          secret.source === "org" ? "outline" : "secondary"
                        }
                        className={
                          secret.source === "org"
                            ? "border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300"
                            : ""
                        }
                      >
                        {secret.source === "org" ? "inherited" : "project"}
                      </Badge>
                      {isAdmin && secret.source === "project" && (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => startEdit(secret)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            className="text-destructive hover:text-destructive/80"
                            onClick={() => handleDelete(secret.key)}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                      {secret.source === "org" && isAdmin && (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => {
                              setNewKey(secret.key);
                              setNewValue("");
                            }}
                            title="Create a project-level override"
                          >
                            Override
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
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
