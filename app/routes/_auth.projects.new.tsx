import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "~/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "~/components/ui/item";
import { H3, Small, Muted } from "~/components/ui/typography";

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
        body.vercelOrgId = selectedVercel.accountId ?? null;
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
    <div className="mx-auto max-w-[960px]">
      <div className="mb-8">
        <H3>New Project</H3>
      </div>

      {/* Project name — always visible */}
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

      {/* Mode tabs */}
      <Tabs
        value={mode}
        onValueChange={(v) => setMode(v as "template" | "import")}
        className="mb-8"
      >
        <TabsList variant="line" className="justify-start gap-4">
          <TabsTrigger
            value="template"
            className="px-0 text-base font-semibold"
          >
            Start from Template
          </TabsTrigger>
          <TabsTrigger value="import" className="px-0 text-base font-semibold">
            Import Existing
          </TabsTrigger>
        </TabsList>

        {/* Template selection */}
        <TabsContent value="template">
          <div className="mt-4 flex flex-col gap-3">
            {TEMPLATES.map((t) => (
              <Item key={t.id} variant="outline">
                <ItemMedia variant="icon">
                  <ReactRouterIcon />
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
                      setSelectedTemplate(t.id);
                    }}
                  >
                    {selectedTemplate === t.id ? "Selected" : "Use"}
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </div>
        </TabsContent>

        {/* Import from Vercel */}
        <TabsContent value="import">
          <Muted className="mb-4 mt-4">
            Import an existing project from Vercel.
          </Muted>

          {vercelLoading && (
            <Muted className="py-4">Loading Vercel projects...</Muted>
          )}

          {vercelError === "not_connected" && (
            <Card className="mt-4">
              <CardContent>
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <VercelIcon />
                    </EmptyMedia>
                    <EmptyTitle>Vercel not connected</EmptyTitle>
                    <EmptyDescription>
                      Connect your Vercel account to import existing projects.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button asChild>
                      <Link to="/settings?tab=user">Go to Settings</Link>
                    </Button>
                  </EmptyContent>
                </Empty>
              </CardContent>
            </Card>
          )}

          {vercelError === "failed" && (
            <Small className="py-4 text-destructive">
              Failed to load Vercel projects.
            </Small>
          )}

          {!vercelLoading && !vercelError && vercelProjects.length === 0 && (
            <Muted className="py-4">No Vercel projects found.</Muted>
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
                        <Small>{vp.name}</Small>
                        <Muted className="text-xs">
                          {vp.framework ?? "No framework"}
                          {vp.link
                            ? ` \u00b7 ${vp.link.org}/${vp.link.repo}`
                            : ""}
                        </Muted>
                      </div>
                      {selectedVercel?.id === vp.id && (
                        <Small className="ml-auto font-bold">&#10003;</Small>
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
      {error && <Small className="mb-4 text-destructive">{error}</Small>}

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
