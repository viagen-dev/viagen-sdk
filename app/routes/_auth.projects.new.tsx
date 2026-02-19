import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { cn } from "~/lib/utils";

const TEMPLATES = [
  {
    id: "react-router",
    name: "React Router",
    description: "Full-stack React with SSR, loaders, and actions",
    framework: "React",
  },
];

type Mode = "template" | "import";

interface VercelProject {
  id: string;
  name: string;
  framework: string | null;
  link?: { type: string; org: string; repo: string };
}

export default function NewProject() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<Mode>("template");
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].id);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Import state
  const [vercelProjects, setVercelProjects] = useState<VercelProject[]>([]);
  const [vercelLoading, setVercelLoading] = useState(false);
  const [vercelError, setVercelError] = useState<string | null>(null);
  const [selectedVercel, setSelectedVercel] = useState<VercelProject | null>(
    null,
  );

  useEffect(() => {
    if (mode === "import" && vercelProjects.length === 0 && !vercelLoading) {
      loadVercelProjects();
    }
  }, [mode]);

  const loadVercelProjects = async () => {
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
    }
  };

  const selectVercelProject = (vp: VercelProject) => {
    setSelectedVercel(vp);
    if (!name) setName(vp.name);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);

    try {
      const body: Record<string, string | null> = { name: name.trim() };

      if (mode === "template") {
        body.templateId = selectedTemplate;
      } else if (selectedVercel) {
        body.vercelProjectId = selectedVercel.id;
        if (selectedVercel.link?.org && selectedVercel.link?.repo) {
          body.githubRepo = `${selectedVercel.link.org}/${selectedVercel.link.repo}`;
        }
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

      navigate("/projects");
    } catch {
      setError("Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  const canCreate =
    name.trim().length > 0 && (mode === "template" || selectedVercel !== null);

  return (
    <div>
      <div className="mb-8">
        <Link
          to="/projects"
          className="mb-2 inline-block text-[0.8125rem] text-muted-foreground no-underline hover:text-foreground"
        >
          &larr; Projects
        </Link>
        <h1 className="text-3xl font-semibold">New Project</h1>
      </div>

      {/* Project name — always visible */}
      <div className="mb-6">
        <label className="mb-2 block text-sm font-medium text-foreground/70">
          Project Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && canCreate && handleCreate()}
          placeholder="my-app"
          className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          autoFocus
        />
      </div>

      {/* Mode tabs */}
      <div className="mb-6 flex gap-1 border-b border-border">
        <button
          onClick={() => setMode("template")}
          className={cn(
            "-mb-px cursor-pointer border-b-2 border-transparent bg-transparent px-4 py-2.5 text-sm font-medium transition-colors",
            mode === "template"
              ? "border-foreground text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Start from Template
        </button>
        <button
          onClick={() => setMode("import")}
          className={cn(
            "-mb-px cursor-pointer border-b-2 border-transparent bg-transparent px-4 py-2.5 text-sm font-medium transition-colors",
            mode === "import"
              ? "border-foreground text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Import Existing
        </button>
      </div>

      {/* Template selection */}
      {mode === "template" && (
        <div className="mb-8">
          <p className="mb-4 text-[0.8125rem] text-muted-foreground">
            Start with a pre-configured template. More coming soon.
          </p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t.id)}
                className={cn(
                  "cursor-pointer rounded-lg border-2 bg-card p-5 text-left transition-colors",
                  selectedTemplate === t.id
                    ? "border-foreground"
                    : "border-border hover:border-foreground/30",
                )}
              >
                <div className="mb-2 flex items-center gap-2">
                  <ReactRouterIcon />
                  <span className="text-[0.9375rem] font-semibold">
                    {t.name}
                  </span>
                  {selectedTemplate === t.id && (
                    <span className="ml-auto text-sm font-bold text-foreground">
                      &#10003;
                    </span>
                  )}
                </div>
                <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
                  {t.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Import from Vercel */}
      {mode === "import" && (
        <div className="mb-8">
          <p className="mb-4 text-[0.8125rem] text-muted-foreground">
            Import an existing project from Vercel.
          </p>

          {vercelLoading && (
            <p className="py-4 text-sm text-muted-foreground">
              Loading Vercel projects...
            </p>
          )}

          {vercelError === "not_connected" && (
            <div className="rounded-lg border border-border p-6 text-center">
              <p className="mb-3 text-sm text-muted-foreground">
                Connect your Vercel account to import projects.
              </p>
              <Link
                to="/settings"
                className="inline-flex items-center rounded-md border border-input px-4 py-2 text-[0.8125rem] font-medium text-foreground/70 no-underline transition-colors hover:bg-accent"
              >
                Go to Settings
              </Link>
            </div>
          )}

          {vercelError === "failed" && (
            <p className="py-4 text-sm text-destructive">
              Failed to load Vercel projects.
            </p>
          )}

          {!vercelLoading && !vercelError && vercelProjects.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">
              No Vercel projects found.
            </p>
          )}

          {!vercelLoading && !vercelError && vercelProjects.length > 0 && (
            <div className="max-h-[360px] overflow-auto">
              {vercelProjects.map((vp) => (
                <button
                  key={vp.id}
                  onClick={() => selectVercelProject(vp)}
                  className={cn(
                    "mb-2 block w-full cursor-pointer rounded-md border-2 bg-transparent p-3 text-left transition-colors",
                    selectedVercel?.id === vp.id
                      ? "border-foreground"
                      : "border-border hover:border-foreground/30",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{vp.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {vp.framework ?? "No framework"}
                        {vp.link
                          ? ` \u00b7 ${vp.link.org}/${vp.link.repo}`
                          : ""}
                      </p>
                    </div>
                    {selectedVercel?.id === vp.id && (
                      <span className="ml-auto text-sm font-bold text-foreground">
                        &#10003;
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mb-4 text-[0.8125rem] text-destructive">{error}</p>
      )}

      {/* Create button */}
      <button
        onClick={handleCreate}
        disabled={!canCreate || creating}
        className={cn(
          "w-full cursor-pointer rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:bg-primary/90",
          (!canCreate || creating) && "cursor-not-allowed opacity-50",
        )}
      >
        {creating
          ? "Creating..."
          : mode === "template"
            ? "Create Project"
            : "Import Project"}
      </button>
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
