import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { redirect } from "react-router";
import { requireAuth } from "~/lib/session.server";
import { getSecret } from "~/lib/infisical.server";
import { cn } from "~/lib/utils";

export async function loader({ request }: { request: Request }) {
  const auth = await requireAuth(request);

  // Check integration status (user-scoped — each user connects their own accounts)
  const safeGet = async (key: string): Promise<boolean> => {
    try {
      const val = await getSecret(`user/${auth.user.id}`, key);
      return !!val;
    } catch {
      return false;
    }
  };
  const [github, vercel] = await Promise.all([
    safeGet("GITHUB_ACCESS_TOKEN"),
    safeGet("VERCEL_ACCESS_TOKEN"),
  ]);

  return {
    user: {
      id: auth.user.id,
      email: auth.user.email,
      name: auth.user.name,
      avatarUrl: auth.user.avatarUrl,
    },
    currentOrg: auth.org,
    organizations: auth.memberships.map((m) => ({
      id: m.organizationId,
      name: m.organizationName,
      role: m.role,
    })),
    integrations: { github, vercel },
  };
}

interface LoaderData {
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

export default function AuthLayout({ loaderData }: { loaderData: LoaderData }) {
  const { user, currentOrg, organizations, integrations } = loaderData;
  const location = useLocation();
  const navigate = useNavigate();

  const handleOrgSwitch = (orgId: string) => {
    document.cookie = `viagen-org=${orgId}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    window.location.reload();
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    navigate("/login");
  };

  const missingIntegrations = !integrations.github || !integrations.vercel;

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-[60px] max-w-[1200px] items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-lg font-semibold text-foreground no-underline"
            >
              viagen
            </Link>
            <span className="text-lg font-light text-border">/</span>
            {organizations.length > 1 ? (
              <select
                value={currentOrg.id}
                onChange={(e) => handleOrgSwitch(e.target.value)}
                className="cursor-pointer rounded-md border border-border bg-transparent px-2 py-1 text-sm font-medium text-foreground"
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm font-medium text-foreground">
                {currentOrg.name}
              </span>
            )}
            <nav className="ml-4 flex gap-1">
              <Link
                to="/"
                className={cn(
                  "rounded-md px-3 py-2 text-sm no-underline transition-colors",
                  location.pathname === "/"
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                Dashboard
              </Link>
              <Link
                to="/projects"
                className={cn(
                  "rounded-md px-3 py-2 text-sm no-underline transition-colors",
                  location.pathname.startsWith("/projects")
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                Projects
              </Link>
              <Link
                to="/settings"
                className={cn(
                  "rounded-md px-3 py-2 text-sm no-underline transition-colors",
                  location.pathname.startsWith("/settings")
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                Settings
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {user.avatarUrl && (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="h-8 w-8 rounded-full"
                />
              )}
              <div className="flex flex-col">
                <p className="text-sm font-medium leading-tight">{user.name}</p>
                <p className="text-xs leading-tight text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="cursor-pointer rounded-md border border-border bg-transparent px-4 py-2 text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {missingIntegrations && (
        <div className="flex items-center justify-center gap-3 border-b border-yellow-400 bg-amber-50 px-4 py-2.5 text-[0.8125rem] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <span>
            {!integrations.github && !integrations.vercel
              ? "Connect your GitHub and Vercel accounts to save sandbox changes."
              : !integrations.github
                ? "Connect your GitHub account to save sandbox changes."
                : "Connect your Vercel account to deploy projects."}
          </span>
          <Link
            to="/settings"
            className="text-[0.8125rem] font-semibold text-amber-800 underline dark:text-amber-200"
          >
            Go to Settings
          </Link>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
