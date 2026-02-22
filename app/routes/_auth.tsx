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
import { ThemeToggle } from "~/components/theme-toggle";
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

  // Check integration status (org-scoped)
  const safeGet = async (key: string): Promise<boolean> => {
    try {
      const val = await getSecret(auth.org.id, key);
      return !!val;
    } catch {
      return false;
    }
  };
  const [github, vercel] = await Promise.all([
    safeGet("GITHUB_TOKEN"),
    safeGet("VERCEL_TOKEN"),
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
      <header className="fixed top-0 right-0 left-0 z-50 border-b border-border bg-background">
        <div className="grid h-[60px] grid-cols-3 items-center px-6">
          <div className="flex items-center">
            {isProjectsIndex ? (
              <Link to="/" className="no-underline">
                <ViagenLogo className="size-8" />
              </Link>
            ) : (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => navigate("/")}
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
          <div className="flex items-center justify-end gap-2">
            <ThemeToggle />
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
                  <Link to="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/billing">Billing</Link>
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

      <main className="mt-[60px] flex-1 bg-muted/30">
        {location.pathname === "/settings" ? (
          <Outlet />
        ) : (
          <div className="mx-auto w-full max-w-[1200px] px-6 py-8">
            <Outlet />
          </div>
        )}
      </main>
    </div>
  );
}
