import { useState, useEffect, useMemo } from "react";
import { SidebarProvider } from "~/lib/sidebar-context";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { useProjectStore } from "~/store/project-store";
import { requireAuth } from "~/lib/session.server";
import { listOrgSecrets } from "~/lib/infisical.server";
import { log } from "~/lib/logger.server";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

import {
  Plus,
  Check,
  ChevronDown,
  ArrowLeftRight,
  Settings,
  Moon,
  Sun,
  CreditCard,
  LogOut,
  UserRound,
} from "lucide-react";
import { AppSidebar } from "~/components/app-sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

import { db } from "~/lib/db/index.server";
import {
  environments as environmentsTable,
  projects as projectsTable,
} from "~/lib/db/schema";
import { eq } from "drizzle-orm";

export async function loader({ request }: { request: Request }) {
  const auth = await requireAuth(request);

  // Check integration status (org-scoped) — single list call
  let orgKeys: Set<string>;
  try {
    const secrets = await listOrgSecrets(auth.org.id);
    orgKeys = new Set(secrets.map((s) => s.key));
  } catch (err) {
    log.error(
      {
        orgId: auth.org.id,
        err: err instanceof Error ? err.message : String(err),
      },
      "integration check failed — listing org secrets threw",
    );
    orgKeys = new Set();
  }

  const github = orgKeys.has("GITHUB_TOKEN");
  const vercel = orgKeys.has("VERCEL_TOKEN");
  const claude =
    orgKeys.has("CLAUDE_ACCESS_TOKEN") || orgKeys.has("ANTHROPIC_API_KEY");

  log.info(
    {
      orgId: auth.org.id,
      orgName: auth.org.name,
      userId: auth.user.id,
      integrations: { github, vercel, claude },
    },
    "integration status loaded",
  );

  // Fetch environments and projects for the sidebar
  const orgEnvironments = await db
    .select({ id: environmentsTable.id, name: environmentsTable.name })
    .from(environmentsTable)
    .where(eq(environmentsTable.organizationId, auth.org.id));

  const orgProjects = await db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      taskPrefix: projectsTable.taskPrefix,
      isDefault: projectsTable.isDefault,
    })
    .from(projectsTable)
    .where(eq(projectsTable.organizationId, auth.org.id));

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
    integrations: { github, vercel, claude },
    environments: orgEnvironments,
    projects: orgProjects,
  };
}

interface LoaderData {
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
  currentOrg: { id: string; name: string; description: string | null };
  organizations: { id: string; name: string; role: string }[];
  integrations: { github: boolean; vercel: boolean; claude: boolean };
  environments: { id: string; name: string }[];
  projects: {
    id: string;
    name: string;
    taskPrefix: string | null;
    isDefault: boolean;
  }[];
}

export default function AuthLayout({ loaderData }: { loaderData: LoaderData }) {
  const {
    user,
    currentOrg,
    organizations,
    integrations,
    environments,
    projects,
  } = loaderData;
  const location = useLocation();
  const navigate = useNavigate();

  const [teamOpen, setTeamOpen] = useState(false); // kept for potential future use
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const toggleSidebar = () => setSidebarOpen((v) => !v);

  // Seed project store from loader data so sidebar is reactive to renames
  const setProjects = useProjectStore((s) => s.setProjects);
  useEffect(() => {
    setProjects(projects.map((p) => ({ ...p, description: null, defaultEnvironmentId: null })));
  }, [projects, setProjects]);

  // Read from store for reactive sidebar
  const storeProjects = useProjectStore((s) => s.projects);
  const sidebarProjects = useMemo(
    () =>
      storeProjects.length > 0
        ? storeProjects.map((p) => ({ id: p.id, name: p.name, taskPrefix: p.taskPrefix, isDefault: p.isDefault }))
        : projects,
    [storeProjects, projects],
  );

  // Persist the last visited path so we can restore it on next visit
  useEffect(() => {
    const path = location.pathname + location.search;
    document.cookie = `viagen-last-path=${encodeURIComponent(path)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }, [location.pathname, location.search]);

  // Auto-switch org when ?org= is in the URL (e.g. from invite emails)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetOrg = params.get("org");
    if (
      targetOrg &&
      targetOrg !== currentOrg.id &&
      organizations.some((o) => o.id === targetOrg)
    ) {
      document.cookie = `viagen-org=${targetOrg}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      // Strip the ?org param and reload
      params.delete("org");
      const clean = params.toString();
      window.location.href = location.pathname + (clean ? `?${clean}` : "");
    }
  }, []);

  const handleOrgSwitch = (value: string) => {
    if (value === "__add_team__") {
      setTeamOpen(false);
      navigate("/onboarding?new_team=true");
      return;
    }
    document.cookie = `viagen-org=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    // Redirect to dashboard to avoid 404s on team-specific pages
    window.location.href = "/dashboard";
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    navigate("/login");
  };

  // ── Theme toggle state (mirrors ThemeToggle component logic) ──────────
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const stored =
      (localStorage.getItem("viagen-theme") as "light" | "dark") || "light";
    setTheme(stored);
  }, []);
  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("viagen-theme", next);
  };

  // The org picker trigger rendered inside the sidebar
  const orgPickerTrigger = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-1.5 font-medium"
        >
          <span className="truncate">{currentOrg.name}</span>
          <ChevronDown className="ml-auto size-3.5 opacity-50 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52" align="start">
        {/* Switch teams submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="flex items-center gap-2">
            <ArrowLeftRight className="size-3.5" />
            Switch teams
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48">
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onSelect={() => handleOrgSwitch(org.id)}
                className="flex items-center gap-2"
              >
                <Check
                  className={cn(
                    "size-3.5 shrink-0",
                    currentOrg.id === org.id ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="truncate">{org.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => handleOrgSwitch("__add_team__")}
              className="flex items-center gap-2"
            >
              <Plus className="size-3.5" />
              Create team
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* Settings, Profile & Billing */}
        <DropdownMenuItem asChild>
          <Link to="/teams" className="flex items-center gap-2">
            <Settings className="size-3.5" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings" className="flex items-center gap-2">
            <UserRound className="size-3.5" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/billing" className="flex items-center gap-2">
            <CreditCard className="size-3.5" />
            Billing
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Theme toggle */}
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            toggleTheme();
          }}
          className="flex items-center gap-2"
        >
          {theme === "light" ? (
            <>
              <Moon className="size-3.5" />
              Switch to dark mode
            </>
          ) : (
            <>
              <Sun className="size-3.5" />
              Switch to light mode
            </>
          )}
        </DropdownMenuItem>

        {/* Log out */}
        <DropdownMenuItem
          variant="destructive"
          onSelect={handleLogout}
          className="flex items-center gap-2"
        >
          <LogOut className="size-3.5" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <SidebarProvider value={{ sidebarOpen, toggleSidebar }}>
      <div className="flex min-h-svh overflow-hidden">
        {/* Sidebar — always shown */}
        <div
          className={cn(
            "fixed top-0 left-0 h-svh z-40 transition-transform duration-200",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <AppSidebar
            environments={environments}
            projects={sidebarProjects}
            currentOrgName={currentOrg.name}
            orgPickerTrigger={orgPickerTrigger}
          />
        </div>

        {/* Main content area — full bleed, each page owns its layout */}
        <main
          className={cn(
            "flex-1 min-w-0 overflow-hidden bg-background transition-[margin] duration-200",
            sidebarOpen ? "ml-[217px]" : "ml-0",
          )}
        >
          <div className="h-svh flex flex-col min-w-0 overflow-hidden">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
