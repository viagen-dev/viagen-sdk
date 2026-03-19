import { useState, useEffect } from "react";
import { SidebarProvider } from "~/lib/sidebar-context";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { requireAuth } from "~/lib/session.server";
import { listOrgSecrets } from "~/lib/infisical.server";
import { log } from "~/lib/logger.server";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

import {
  Plus,
  Check,
  ChevronsUpDown,
  ArrowLeft,
  ChevronDown,
} from "lucide-react";
import { AppSidebar } from "~/components/app-sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "~/components/ui/command";

import { db } from "~/lib/db/index.server";
import { environments as environmentsTable } from "~/lib/db/schema";
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

  // Fetch environments for the sidebar
  const orgEnvironments = await db
    .select({ id: environmentsTable.id, name: environmentsTable.name })
    .from(environmentsTable)
    .where(eq(environmentsTable.organizationId, auth.org.id));

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
  integrations: { github: boolean; vercel: boolean; claude: boolean };
  environments: { id: string; name: string }[];
}

export default function AuthLayout({ loaderData }: { loaderData: LoaderData }) {
  const { user, currentOrg, organizations, integrations, environments } =
    loaderData;
  const location = useLocation();
  const navigate = useNavigate();

  const [teamOpen, setTeamOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const toggleSidebar = () => setSidebarOpen((v) => !v);

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

  const isProjectsIndex = location.pathname === "/dashboard";
  const isTasksPage = location.pathname === "/tasks";
  const isTaskDetailPage = /^\/environments\/[^/]+\/tasks\/[^/]+/.test(
    location.pathname,
  );

  // Pages that show the sidebar
  const showSidebar = isProjectsIndex || isTasksPage || isTaskDetailPage;

  // The org picker trigger rendered inside the sidebar
  const orgPickerTrigger = (
    <Popover open={teamOpen} onOpenChange={setTeamOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          role="combobox"
          aria-expanded={teamOpen}
          className="w-full justify-start gap-1.5 font-medium"
        >
          <span className="truncate">{currentOrg.name}</span>
          <ChevronDown className="ml-auto size-3.5 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search teams..." />
          <CommandList>
            <CommandEmpty>No teams found.</CommandEmpty>
            <CommandGroup>
              {organizations.map((org) => (
                <CommandItem
                  key={org.id}
                  value={org.name}
                  onSelect={() => handleOrgSwitch(org.id)}
                >
                  {org.name}
                  <Check
                    className={cn(
                      "ml-auto size-3.5",
                      currentOrg.id === org.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="Create team"
                onSelect={() => handleOrgSwitch("__add_team__")}
              >
                <Plus className="size-3.5" />
                Create team
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  // Non-sidebar pages: show a minimal top bar with back button + org switcher
  const nonSidebarTopBar = !showSidebar && (
    <header className="fixed top-0 right-0 left-0 z-50 border-b border-border bg-background">
      <div className="flex h-[52px] items-center px-4 gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" />
        </Button>

        <Popover open={teamOpen} onOpenChange={setTeamOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              role="combobox"
              aria-expanded={teamOpen}
              className="gap-1.5 font-medium"
            >
              {currentOrg.name}
              <ChevronsUpDown className="size-3.5 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search teams..." />
              <CommandList>
                <CommandEmpty>No teams found.</CommandEmpty>
                <CommandGroup>
                  {organizations.map((org) => (
                    <CommandItem
                      key={org.id}
                      value={org.name}
                      onSelect={() => handleOrgSwitch(org.id)}
                    >
                      {org.name}
                      <Check
                        className={cn(
                          "ml-auto size-3.5",
                          currentOrg.id === org.id
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="Create team"
                    onSelect={() => handleOrgSwitch("__add_team__")}
                  >
                    <Plus className="size-3.5" />
                    Create team
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );

  return (
    <SidebarProvider value={{ sidebarOpen, toggleSidebar }}>
      <div className="flex min-h-svh overflow-hidden">
        {nonSidebarTopBar}

        {/* Left sidebar — only on dashboard and tasks pages */}
        {showSidebar && (
          <div
            className={cn(
              "fixed top-0 left-0 h-svh z-40 transition-transform duration-200",
              sidebarOpen ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <AppSidebar
              environments={environments}
              currentOrgName={currentOrg.name}
              orgPickerTrigger={orgPickerTrigger}
              user={user}
              onLogout={handleLogout}
              onEnvironmentSelect={(environmentId: string) => {
                navigate(`/dashboard?filterApp=${environmentId}`);
              }}
            />
          </div>
        )}

        {/* Main content area */}
        <main
          className={cn(
            "flex-1 min-w-0 overflow-hidden bg-muted/30 transition-[margin] duration-200",
            showSidebar && sidebarOpen && "ml-[217px]",
            showSidebar && !sidebarOpen && "ml-0",
            !showSidebar && "mt-[52px]",
          )}
        >
          {/* /tasks — full-bleed, no padding (page manages its own layout) */}
          {isTasksPage ? (
            <div className="h-svh flex flex-col min-w-0 overflow-hidden">
              <Outlet />
            </div>
          ) : /* task detail page — full bleed, page manages its own layout */
          isTaskDetailPage ? (
            <div className="h-svh flex flex-col min-w-0 overflow-hidden">
              <Outlet />
            </div>
          ) : /* /dashboard — full-width with padding */
          isProjectsIndex ? (
            <div className="w-full px-6 py-8">
              <Outlet />
            </div>
          ) : /* /settings — full-width, no max constraint */
          location.pathname === "/settings" ? (
            <Outlet />
          ) : (
            /* All other auth pages — centered with max-width */
            <div className="mx-auto w-full max-w-[1200px] px-6 py-8">
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </SidebarProvider>
  );
}
