import { useState } from "react";
import { Link, useLocation } from "react-router";
import {
  CheckCircle2,
  Plus,
  Box,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Moon,
  Sun,
  Settings,
  CreditCard,
  LogOut,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { ThemeToggle } from "~/components/theme-toggle";

interface AppSidebarProps {
  environments: Array<{ id: string; name: string }>;
  currentOrgName: string;
  orgPickerTrigger: React.ReactNode;
  selectedEnvironmentId?: string | null;
  onEnvironmentSelect?: (environmentId: string) => void;
  user: {
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  onLogout: () => void;
}

export function AppSidebar({
  environments,
  currentOrgName,
  orgPickerTrigger,
  selectedEnvironmentId,
  onEnvironmentSelect,
  user,
  onLogout,
}: AppSidebarProps) {
  const location = useLocation();
  const [environmentsExpanded, setEnvironmentsExpanded] = useState(true);
  const [reposExpanded, setReposExpanded] = useState(false);

  const sortedEnvironments = [...environments].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const isTasksActive = location.pathname === "/tasks";

  const userInitials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email[0].toUpperCase();

  return (
    <aside className="flex h-full w-[217px] shrink-0 flex-col border-r border-border bg-background p-4">
      {/* Org picker */}
      <div className="mb-4">{orgPickerTrigger}</div>

      {/* My tasks */}
      <Button
        variant="ghost"
        size="sm"
        asChild
        className={cn(
          "w-full justify-start gap-2",
          isTasksActive && "bg-accent text-accent-foreground",
        )}
      >
        <Link to="/tasks">
          <CheckCircle2 className="size-4" />
          <span>My tasks</span>
        </Link>
      </Button>

      {/* Divider */}
      <div className="my-3 border-t border-border" />

      {/* Projects section */}
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setEnvironmentsExpanded((prev) => !prev)}
          className="flex w-full items-center gap-1 px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {environmentsExpanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
          <span>Projects</span>
        </button>

        {environmentsExpanded && (
          <div className="flex flex-col gap-0.5">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="w-full justify-start gap-2 shadow-none"
            >
              <Link to="/environments/new">
                <Plus className="size-4" />
                <span>New app</span>
              </Link>
            </Button>

            {sortedEnvironments.map((env) => (
              <Button
                key={env.id}
                variant="ghost"
                size="sm"
                className={cn(
                  "w-full justify-start gap-2",
                  selectedEnvironmentId === env.id &&
                    "bg-accent text-accent-foreground",
                )}
                onClick={() => onEnvironmentSelect?.(env.id)}
              >
                <Box className="size-4" />
                <span className="truncate">{env.name}</span>
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="my-3 border-t border-border" />

      {/* Repos section (placeholder) */}
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setReposExpanded((prev) => !prev)}
          className="flex w-full items-center gap-1 px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {reposExpanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
          <span>Repos</span>
        </button>

        {reposExpanded && (
          <div className="px-2 py-2">
            <p className="text-xs text-muted-foreground">No repos connected</p>
          </div>
        )}
      </div>

      {/* Spacer pushes footer to bottom */}
      <div className="flex-1" />

      {/* Bottom footer: theme toggle + user avatar */}
      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between px-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring w-full min-w-0">
                <Avatar className="size-7 shrink-0">
                  {user.avatarUrl ? (
                    <AvatarImage src={user.avatarUrl} alt={user.name ?? ""} />
                  ) : null}
                  <AvatarFallback className="text-xs">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-sm font-medium">
                  {user.name ?? user.email}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-48">
              <div className="px-2 py-1.5">
                <p className="text-xs font-medium truncate">
                  {user.name ?? ""}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex items-center gap-2">
                  <Settings className="size-3.5" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/billing" className="flex items-center gap-2">
                  <CreditCard className="size-3.5" />
                  Billing
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={onLogout}
                className="flex items-center gap-2"
              >
                <LogOut className="size-3.5" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
