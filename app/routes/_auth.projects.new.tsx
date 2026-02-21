import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

const TEMPLATES = [
  {
    id: "react-router",
    name: "React Router",
    description: "Full-stack React with SSR, loaders, and actions",
    framework: "React",
  },
];

interface VercelProject {
  id: string;
  name: string;
  framework: string | null;
  accountId?: string;
  link?: { type: string; org: string; repo: string };
}

export default function NewProject() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"template" | "import">("template");
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
        body.vercelTeamId = selectedVercel.accountId ?? null;
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
        <Button
          variant="link"
          asChild
          className="mb-2 h-auto p-0 text-muted-foreground"
        >
          <Link to="/projects">&larr; Projects</Link>
        </Button>
        <h1 className="text-3xl font-semibold">New Project</h1>
      </div>

      {/* Project name — always visible */}
      <div className="mb-6 space-y-2">
        <Label htmlFor="project-name" className="text-foreground/70">
          Project Name
        </Label>
        <Input
          id="project-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && canCreate && handleCreate()}
          placeholder="my-app"
          autoFocus
        />
      </div>

      {/* Mode tabs */}
      <Tabs
        value={mode}
        onValueChange={(v) => setMode(v as "template" | "import")}
        className="mb-8"
      >
        <TabsList
          variant="line"
          className="w-full justify-start border-b border-border"
        >
          <TabsTrigger value="template">Start from Template</TabsTrigger>
          <TabsTrigger value="import">Import Existing</TabsTrigger>
        </TabsList>

        {/* Template selection */}
        <TabsContent value="template">
          <p className="mb-4 mt-4 text-[0.8125rem] text-muted-foreground">
            Start with a pre-configured template. More coming soon.
          </p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {TEMPLATES.map((t) => (
              <Card
                key={t.id}
                onClick={() => setSelectedTemplate(t.id)}
                className={cn(
                  "cursor-pointer border-2 transition-colors",
                  selectedTemplate === t.id
                    ? "border-foreground"
                    : "border-border hover:border-foreground/30",
                )}
              >
                <CardContent>
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
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Import from Vercel */}
        <TabsContent value="import">
          <p className="mb-4 mt-4 text-[0.8125rem] text-muted-foreground">
            Import an existing project from Vercel.
          </p>

          {vercelLoading && (
            <p className="py-4 text-sm text-muted-foreground">
              Loading Vercel projects...
            </p>
          )}

          {vercelError === "not_connected" && (
            <Card className="text-center">
              <CardContent>
                <p className="mb-3 text-sm text-muted-foreground">
                  Connect your Vercel account to import projects.
                </p>
                <Button variant="outline" asChild>
                  <Link to="/settings">Go to Settings</Link>
                </Button>
              </CardContent>
            </Card>
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
                <Card
                  key={vp.id}
                  onClick={() => selectVercelProject(vp)}
                  className={cn(
                    "mb-2 cursor-pointer border-2 transition-colors",
                    selectedVercel?.id === vp.id
                      ? "border-foreground"
                      : "border-border hover:border-foreground/30",
                  )}
                >
                  <CardContent>
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
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Error */}
      {error && (
        <p className="mb-4 text-[0.8125rem] text-destructive">{error}</p>
      )}

      {/* Create button */}
      <Button
        onClick={handleCreate}
        disabled={!canCreate || creating}
        className="w-full"
      >
        {creating
          ? "Creating..."
          : mode === "template"
            ? "Create Project"
            : "Import Project"}
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
