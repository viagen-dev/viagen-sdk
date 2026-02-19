import { Link } from "react-router";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects } from "~/lib/db/schema";
import { eq } from "drizzle-orm";

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
}

export default function Projects({
  loaderData,
}: {
  loaderData: { projects: Project[] };
}) {
  const { projects } = loaderData;

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-semibold">Projects</h1>
          <p className="text-[0.9375rem] text-muted-foreground">
            Manage your viagen projects
          </p>
        </div>
        <Link
          to="/projects/new"
          className="inline-flex items-center whitespace-nowrap rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground no-underline transition-colors hover:bg-primary/90"
        >
          New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/50 px-8 py-16">
          <h3 className="mb-2 text-lg font-semibold">No projects yet</h3>
          <p className="text-center text-sm text-muted-foreground">
            Create your first project to get started
          </p>
          <Link
            to="/projects/new"
            className="mt-4 inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground no-underline transition-colors hover:bg-primary/90"
          >
            New Project
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="rounded-lg border border-border bg-card p-6"
            >
              <div className="mb-4">
                <h3 className="mb-1 text-base font-semibold">{project.name}</h3>
                <p className="text-[0.8125rem] text-muted-foreground">
                  Created {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </div>

              {project.templateId && (
                <div className="mb-2 flex items-center gap-2">
                  <span className="inline-block rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {project.templateId}
                  </span>
                </div>
              )}

              {project.vercelProjectId && (
                <div
                  className={`flex items-center gap-2 ${project.githubRepo ? "mb-2" : ""}`}
                >
                  <VercelIcon />
                  <span className="text-[0.8125rem] text-muted-foreground">
                    {project.vercelProjectId}
                  </span>
                </div>
              )}

              {project.githubRepo && (
                <div className="flex items-center gap-2">
                  <GitHubIcon />
                  <span className="text-[0.8125rem] text-muted-foreground">
                    {project.githubRepo}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VercelIcon() {
  return (
    <svg
      width="14"
      height="14"
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
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="shrink-0"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
