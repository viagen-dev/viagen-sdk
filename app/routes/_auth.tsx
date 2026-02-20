import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { redirect } from "react-router";
import { requireAuth } from "~/lib/session.server";
import { getSecret } from "~/lib/infisical.server";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { ViagenLogo } from "~/components/icons/viagen-logo";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Plus, Check, ChevronsUpDown, ArrowLeft } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

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

  const [teamOpen, setTeamOpen] = useState(false);

  const handleOrgSwitch = (value: string) => {
    if (value === "__add_team__") {
      setTeamOpen(false);
      navigate("/onboarding");
      return;
    }
    document.cookie = `viagen-org=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
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

  const isProjectsIndex = location.pathname === "/";

  const userInitials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email[0].toUpperCase();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-border bg-background">
        <div className="mx-auto grid h-[60px] max-w-[1200px] grid-cols-3 items-center px-6">
          <div className="flex items-center">
            {isProjectsIndex ? (
              <Link to="/" className="no-underline">
                <ViagenLogo className="size-8" />
              </Link>
            ) : (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="size-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center justify-center">
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
              <PopoverContent className="w-[200px] p-0" align="center">
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
                        value="Add team"
                        onSelect={() => handleOrgSwitch("__add_team__")}
                      >
                        <Plus className="size-3.5" />
                        Add team
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar>
                    {user.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt={user.name ?? ""} />
                    ) : null}
                    <AvatarFallback>{userInitials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/settings">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings">Billing</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings">Team settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
          <Button
            variant="link"
            size="sm"
            asChild
            className="h-auto p-0 font-semibold text-amber-800 dark:text-amber-200"
          >
            <Link to="/settings">Go to Settings</Link>
          </Button>
        </div>
      )}

      <main className="flex-1 bg-muted">
        <div className="mx-auto w-full max-w-[1200px] px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
