import { useState, useEffect } from "react";
import { useRouteLoaderData, useSearchParams, useNavigate } from "react-router";
import { toast } from "sonner";
import { Ellipsis, Database } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Input } from "~/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
} from "~/components/ui/navigation-menu";
import { Small, Muted } from "~/components/ui/typography";
import { Separator } from "~/components/ui/separator";
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "~/components/ui/item";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

interface ParentData {
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

interface Member {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
  joinedAt: string;
}

interface KeyStatus {
  connected: boolean;
  scope: string;
  keyPrefix?: string;
}

interface DatabaseInfo {
  id: string;
  name: string;
  type: string;
  provider: string;
  status: string;
  createdAt: string;
}

function initials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(/[\s-_]+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email.slice(0, 2).toUpperCase();
}

export default function Settings() {
  const parentData = useRouteLoaderData("routes/_auth") as ParentData;
  const { user, currentOrg, organizations, integrations } = parentData;
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const currentRole =
    organizations.find((o) => o.id === currentOrg.id)?.role ?? "member";
  const isAdmin = currentRole === "admin" || currentRole === "owner";

  // --- Profile state ---
  const [displayName, setDisplayName] = useState(user.name ?? "");
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const displayNameChanged = displayName.trim() !== (user.name ?? "");

  const [email, setEmail] = useState(user.email);
  const [savingEmail, setSavingEmail] = useState(false);
  const emailChanged = email.trim() !== user.email;

  // --- Account state ---
  const [githubConnected, setGithubConnected] = useState(integrations.github);
  const [vercelConnected, setVercelConnected] = useState(integrations.vercel);

  // --- Team state ---
  // Org name
  const [orgName, setOrgName] = useState(currentOrg.name);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const nameChanged = orgName.trim() !== currentOrg.name;

  // Members
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [addEmail, setAddEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Org Claude key
  const [orgKey, setOrgKey] = useState<KeyStatus | null>(null);
  const [orgKeyInput, setOrgKeyInput] = useState("");
  const [savingOrgKey, setSavingOrgKey] = useState(false);

  // Data sources state
  const [dbList, setDbList] = useState<DatabaseInfo[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [showDbForm, setShowDbForm] = useState(false);
  const [dbProvider, setDbProvider] = useState<"manual" | "neon">("manual");
  const [dbName, setDbName] = useState("");
  const [dbType, setDbType] = useState("pg");
  const [dbConnectionString, setDbConnectionString] = useState("");
  const [savingDb, setSavingDb] = useState(false);
  const [deletingDbId, setDeletingDbId] = useState<string | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);

  // Clean up OAuth redirect params from URL (but preserve tab)
  useEffect(() => {
    if (searchParams.has("connected") || searchParams.has("error")) {
      const tab = searchParams.get("tab");
      setSearchParams(tab ? { tab } : {}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Fetch Claude key status
  useEffect(() => {
    fetch("/api/claude-key?scope=org", { credentials: "include" })
      .then((r) => r.json())
      .then(setOrgKey)
      .catch(() => {});
  }, []);

  // Fetch members
  const fetchMembers = () => {
    fetch("/api/orgs/members", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setMembers(data.members))
      .catch(() => setMembersError("Failed to load members"))
      .finally(() => setMembersLoading(false));
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  // Fetch data sources
  const fetchDatabases = () => {
    fetch("/api/databases", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setDbList(data.databases ?? []))
      .catch(() => setDbError("Failed to load data sources"))
      .finally(() => setDbLoading(false));
  };

  useEffect(() => {
    fetchDatabases();
  }, []);

  // --- Data sources handlers ---
  const handleAddDatabase = async () => {
    if (!dbName.trim()) return;
    if (dbProvider === "manual" && !dbConnectionString.trim()) return;
    setSavingDb(true);
    setDbError(null);
    try {
      const body: Record<string, string> = {
        name: dbName.trim(),
        type: dbType,
        provider: dbProvider,
      };
      if (dbProvider === "manual") {
        body.connectionString = dbConnectionString;
      }
      const res = await fetch("/api/databases", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setDbError(data.error ?? "Failed to add data source");
        return;
      }
      setDbList((prev) => [...prev, data.database]);
      setShowDbForm(false);
      setDbName("");
      setDbConnectionString("");
      toast.success("Data source added");
    } catch {
      setDbError("Failed to add data source");
    } finally {
      setSavingDb(false);
    }
  };

  const handleDeleteDatabase = async (id: string) => {
    setDeletingDbId(id);
    setDbError(null);
    try {
      const res = await fetch("/api/databases", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setDbList((prev) => prev.filter((d) => d.id !== id));
        toast.success("Data source deleted");
      } else {
        const data = await res.json().catch(() => ({}));
        setDbError(data.error ?? "Failed to delete data source");
      }
    } catch {
      setDbError("Failed to delete data source");
    } finally {
      setDeletingDbId(null);
    }
  };

  // --- Profile handlers ---
  const saveDisplayName = async () => {
    if (!displayName.trim() || savingDisplayName) return;
    setSavingDisplayName(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: displayName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to save display name");
        return;
      }
      toast.success("Display name saved");
    } catch {
      toast.error("Failed to save display name");
    } finally {
      setSavingDisplayName(false);
    }
  };

  const saveEmail = async () => {
    if (!email.trim() || savingEmail) return;
    setSavingEmail(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to save email");
        return;
      }
      toast.success("Email saved");
    } catch {
      toast.error("Failed to save email");
    } finally {
      setSavingEmail(false);
    }
  };

  // --- Account handlers ---
  const disconnectGithub = async () => {
    await fetch("/api/integrations/github", {
      method: "DELETE",
      credentials: "include",
    });
    setGithubConnected(false);
    toast.success("GitHub disconnected");
  };

  const disconnectVercel = async () => {
    await fetch("/api/integrations/vercel", {
      method: "DELETE",
      credentials: "include",
    });
    setVercelConnected(false);
    toast.success("Vercel disconnected");
  };

  // --- Team handlers ---
  const handleRenameOrg = async () => {
    if (!orgName.trim() || savingName) return;
    setSavingName(true);
    setNameError(null);
    try {
      const res = await fetch("/api/orgs", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setNameError(data.error ?? "Failed to rename organization");
        return;
      }
      setNameSaved(true);
      toast.success("Organization renamed");
    } catch {
      setNameError("Failed to rename organization");
      toast.error("Failed to rename organization");
    } finally {
      setSavingName(false);
    }
  };

  const handleAddMember = async () => {
    if (!addEmail.trim() || adding) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/orgs/members", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addEmail.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAddError(data.error ?? "Failed to add member");
        setAdding(false);
        return;
      }
      setAddEmail("");
      fetchMembers();
      toast.success("Member added");
    } catch {
      setAddError("Failed to add member");
      toast.error("Failed to add member");
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setMembersError(null);
    try {
      const res = await fetch("/api/orgs/members", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMembersError(data.error ?? "Failed to remove member");
        return;
      }
      setMembers((prev) => prev.filter((m) => m.id !== userId));
      toast.success("Member removed");
    } catch {
      setMembersError("Failed to remove member");
      toast.error("Failed to remove member");
    }
  };

  const handleLeaveTeam = async () => {
    setMembersError(null);
    try {
      const res = await fetch("/api/orgs/members", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to leave team");
        return;
      }
      toast.success(`You left ${currentOrg.name}`);
      // Switch to another org or redirect to onboarding
      const otherOrg = organizations.find((o) => o.id !== currentOrg.id);
      if (otherOrg) {
        document.cookie = `viagen-org=${otherOrg.id}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
        window.location.href = "/";
      } else {
        navigate("/onboarding");
      }
    } catch {
      toast.error("Failed to leave team");
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setMembersError(null);
    try {
      const res = await fetch("/api/orgs/members", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMembersError(data.error ?? "Failed to update role");
        return;
      }
      setMembers((prev) =>
        prev.map((m) => (m.id === userId ? { ...m, role: newRole } : m)),
      );
      toast.success("Role updated");
    } catch {
      setMembersError("Failed to update role");
      toast.error("Failed to update role");
    }
  };

  const saveOrgKey = async () => {
    if (!orgKeyInput.trim()) return;
    setSavingOrgKey(true);
    await fetch("/api/claude-key", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: orgKeyInput.trim(), scope: "org" }),
    });
    const res = await fetch("/api/claude-key?scope=org", {
      credentials: "include",
    });
    setOrgKey(await res.json());
    setOrgKeyInput("");
    setSavingOrgKey(false);
    toast.success("Organization Claude key saved");
  };

  const removeOrgKey = async () => {
    setSavingOrgKey(true);
    await fetch("/api/claude-key?scope=org", {
      method: "DELETE",
      credentials: "include",
    });
    setOrgKey({ connected: false, scope: "org" });
    setSavingOrgKey(false);
    toast.success("Organization Claude key removed");
  };

  type Section = "profile" | "settings" | "data-sources";
  const getInitialSection = (): Section => {
    const tab = searchParams.get("tab");
    if (tab === "profile" || tab === "data-sources") return tab;
    if (tab === "settings" || tab === "user" || tab === "team")
      return "settings";
    if (searchParams.has("connected") || searchParams.has("error"))
      return "settings";
    return "profile";
  };
  const [activeSection, setActiveSection] = useState<Section>(
    getInitialSection,
  );

  const handleSectionChange = (section: Section) => {
    setActiveSection(section);
    setSearchParams({ tab: section }, { replace: true });
  };

  return (
    <div className="flex min-h-[calc(100svh-60px)]">
      <nav className="shrink-0 border-r border-border px-4 py-8 md:w-[220px]">
        <NavigationMenu
          orientation="vertical"
          viewport={false}
          className="w-full items-start"
        >
          <NavigationMenuList className="flex-col items-start gap-1">
            <NavigationMenuItem>
              <NavigationMenuLink
                data-active={activeSection === "profile"}
                className="cursor-pointer hover:bg-[oklch(0.94_0_0)] data-[active=true]:bg-[oklch(0.94_0_0)] data-[active=true]:hover:bg-[oklch(0.94_0_0)]"
                onSelect={() => handleSectionChange("profile")}
              >
                Profile
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                data-active={activeSection === "settings"}
                className="cursor-pointer hover:bg-[oklch(0.94_0_0)] data-[active=true]:bg-[oklch(0.94_0_0)] data-[active=true]:hover:bg-[oklch(0.94_0_0)]"
                onSelect={() => handleSectionChange("settings")}
              >
                Settings
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                data-active={activeSection === "data-sources"}
                className="cursor-pointer hover:bg-[oklch(0.94_0_0)] data-[active=true]:bg-[oklch(0.94_0_0)] data-[active=true]:hover:bg-[oklch(0.94_0_0)]"
                onSelect={() => handleSectionChange("data-sources")}
              >
                Data Sources
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </nav>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-[960px]">
          {/* ===== PROFILE SECTION ===== */}
          {activeSection === "profile" && (
            <>
              <div className="mb-8">
                <Card>
                  <CardHeader>
                    <CardTitle>Display Name</CardTitle>
                    <CardDescription>
                      Your display name. This is how others will see you.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Input
                      id="profile-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name"
                      className="max-w-md"
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        displayNameChanged &&
                        saveDisplayName()
                      }
                    />
                  </CardContent>
                  <CardFooter className="border-t justify-between">
                    <Muted>Please use 32 characters at maximum.</Muted>
                    <Button
                      onClick={saveDisplayName}
                      disabled={
                        !displayNameChanged ||
                        !displayName.trim() ||
                        savingDisplayName
                      }
                    >
                      {savingDisplayName ? "Saving..." : "Save"}
                    </Button>
                  </CardFooter>
                </Card>
              </div>

              <div className="mb-8">
                <Card>
                  <CardHeader>
                    <CardTitle>Email</CardTitle>
                    <CardDescription>
                      Your email address used for notifications and sign in.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <Input
                        id="profile-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="max-w-md"
                        onKeyDown={(e) =>
                          e.key === "Enter" && emailChanged && saveEmail()
                        }
                      />
                      <Badge className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
                        Verified
                      </Badge>
                    </div>
                  </CardContent>
                  <CardFooter className="border-t justify-between">
                    <Muted>We will email you to verify the change.</Muted>
                    <Button
                      onClick={saveEmail}
                      disabled={!emailChanged || !email.trim() || savingEmail}
                    >
                      {savingEmail ? "Saving..." : "Save"}
                    </Button>
                  </CardFooter>
                </Card>
              </div>

              {/* Danger Zone */}
              <div className="mb-8">
                <Card className="border-destructive">
                  <CardHeader>
                    <CardTitle>Delete Account</CardTitle>
                    <CardDescription>
                      Permanently remove your personal account and all of its
                      contents. This action is not reversible, so please
                      continue with caution.
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="border-t border-destructive bg-destructive/5 justify-end">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive">
                          Delete Personal Account
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Are you absolutely sure?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently
                            delete your account and remove all of your data from
                            our servers.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <CardFooter className="border-t justify-end gap-2 -mx-6 -mb-6 mt-2">
                          <AlertDialogCancel size="sm">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction variant="destructive" size="sm">
                            Delete Account
                          </AlertDialogAction>
                        </CardFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardFooter>
                </Card>
              </div>
            </>
          )}

          {/* ===== SETTINGS SECTION ===== */}
          {activeSection === "settings" && (
            <>
              {/* GitHub */}
              <div className="mb-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GitHubIcon />
                      GitHub
                    </CardTitle>
                    <CardDescription>
                      Connect GitHub to access repositories for{" "}
                      {currentOrg.name}.
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="border-t justify-between">
                    {githubConnected ? (
                      <>
                        <Badge className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
                          Connected
                        </Badge>
                        {isAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={disconnectGithub}
                          >
                            Disconnect
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <Muted>Not connected</Muted>
                        {isAdmin && (
                          <Button asChild>
                            <a href="/api/integrations/github/start?return_to=/settings">
                              Connect
                            </a>
                          </Button>
                        )}
                      </>
                    )}
                  </CardFooter>
                </Card>
              </div>

              {/* Vercel */}
              <div className="mb-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <VercelIcon />
                      Vercel
                    </CardTitle>
                    <CardDescription>
                      Connect Vercel to deploy projects for {currentOrg.name}.
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="border-t justify-between">
                    {vercelConnected ? (
                      <>
                        <Badge className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
                          Connected
                        </Badge>
                        {isAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={disconnectVercel}
                          >
                            Disconnect
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <Muted>Not connected</Muted>
                        {isAdmin && (
                          <Button asChild>
                            <a href="/api/integrations/vercel/start?return_to=/settings">
                              Connect
                            </a>
                          </Button>
                        )}
                      </>
                    )}
                  </CardFooter>
                </Card>
              </div>

              <Separator className="my-8" />

              {/* Claude Key */}
              <div className="mb-8">
                <Card>
                  <CardHeader>
                    <CardTitle>Claude Key</CardTitle>
                    <CardDescription>
                      Shared Anthropic API key for all projects in{" "}
                      {currentOrg.name}. Projects can override with their own
                      key.
                    </CardDescription>
                  </CardHeader>
                  {orgKey?.connected ? (
                    <CardFooter className="border-t justify-between">
                      <Badge className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
                        {orgKey.keyPrefix}
                      </Badge>
                      {isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={removeOrgKey}
                          disabled={savingOrgKey}
                        >
                          Remove
                        </Button>
                      )}
                    </CardFooter>
                  ) : isAdmin ? (
                    <>
                      <CardContent>
                        <Input
                          type="password"
                          value={orgKeyInput}
                          onChange={(e) => setOrgKeyInput(e.target.value)}
                          placeholder="sk-ant-api..."
                          className="max-w-md"
                          onKeyDown={(e) => e.key === "Enter" && saveOrgKey()}
                        />
                      </CardContent>
                      <CardFooter className="border-t justify-between">
                        <Muted>Not connected</Muted>
                        <Button
                          onClick={saveOrgKey}
                          disabled={!orgKeyInput.trim() || savingOrgKey}
                        >
                          {savingOrgKey ? "Saving..." : "Save"}
                        </Button>
                      </CardFooter>
                    </>
                  ) : (
                    <CardFooter className="border-t">
                      <Muted className="italic">
                        Only admins can set the organization key.
                      </Muted>
                    </CardFooter>
                  )}
                </Card>
              </div>

              {/* Organization Name */}
              <div className="mb-8">
                <Card>
                  <CardHeader>
                    <CardTitle>Organization Name</CardTitle>
                    <CardDescription>
                      The name of your organization. This is visible to all
                      members.
                    </CardDescription>
                  </CardHeader>
                  {isAdmin ? (
                    <>
                      <CardContent>
                        <Input
                          type="text"
                          value={orgName}
                          onChange={(e) => {
                            setOrgName(e.target.value);
                            setNameSaved(false);
                            setNameError(null);
                          }}
                          placeholder="Organization name"
                          className="max-w-md"
                          onKeyDown={(e) =>
                            e.key === "Enter" &&
                            nameChanged &&
                            handleRenameOrg()
                          }
                        />
                        {nameError && (
                          <p className="mt-2 text-sm text-destructive">
                            {nameError}
                          </p>
                        )}
                      </CardContent>
                      <CardFooter className="border-t justify-end">
                        <Button
                          onClick={handleRenameOrg}
                          disabled={
                            !nameChanged || !orgName.trim() || savingName
                          }
                        >
                          {savingName
                            ? "Saving..."
                            : nameSaved
                              ? "Saved"
                              : "Save"}
                        </Button>
                      </CardFooter>
                    </>
                  ) : (
                    <CardContent>
                      <Small>{currentOrg.name}</Small>
                    </CardContent>
                  )}
                </Card>
              </div>

              {/* Members */}
              <div className="mb-8">
                <Card>
                  <CardHeader>
                    <CardTitle>Team members</CardTitle>
                    <CardDescription>
                      Manage who has access to this organization.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {membersError && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertDescription>{membersError}</AlertDescription>
                      </Alert>
                    )}

                    {/* Add member form */}
                    {isAdmin && (
                      <>
                        {addError && (
                          <Alert variant="destructive" className="mb-3">
                            <AlertDescription>{addError}</AlertDescription>
                          </Alert>
                        )}
                        <Item size="sm" className="px-0 py-0 mb-4">
                          <ItemContent>
                            <Input
                              type="email"
                              value={addEmail}
                              onChange={(e) => setAddEmail(e.target.value)}
                              placeholder="user@example.com"
                              onKeyDown={(e) =>
                                e.key === "Enter" && handleAddMember()
                              }
                            />
                          </ItemContent>
                          <ItemActions>
                            <Button
                              onClick={handleAddMember}
                              disabled={!addEmail.trim() || adding}
                              size="sm"
                            >
                              {adding ? "Adding..." : "Add"}
                            </Button>
                          </ItemActions>
                        </Item>
                      </>
                    )}

                    {/* Member list */}
                    {membersLoading ? (
                      <Muted className="py-4">Loading...</Muted>
                    ) : members.length === 0 ? (
                      <Muted className="py-4">No members found.</Muted>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {members.map((member) => {
                          const isSelf = member.id === user.id;
                          return (
                            <Item key={member.id} variant="outline" size="sm">
                              <ItemMedia variant="image">
                                <Avatar size="sm">
                                  {member.avatarUrl && (
                                    <AvatarImage
                                      src={member.avatarUrl}
                                      alt={member.name ?? member.email}
                                    />
                                  )}
                                  <AvatarFallback className="text-xs">
                                    {initials(member.name, member.email)}
                                  </AvatarFallback>
                                </Avatar>
                              </ItemMedia>
                              <ItemContent>
                                <ItemTitle>
                                  {member.name ?? member.email}
                                  {isSelf && (
                                    <span className="text-xs font-normal text-muted-foreground">
                                      (you)
                                    </span>
                                  )}
                                </ItemTitle>
                                {member.name && (
                                  <ItemDescription className="truncate text-xs">
                                    {member.email}
                                  </ItemDescription>
                                )}
                              </ItemContent>
                              <ItemActions>
                                {isAdmin &&
                                !isSelf &&
                                member.role !== "owner" ? (
                                  <Select
                                    value={member.role}
                                    onValueChange={(val) =>
                                      handleRoleChange(member.id, val)
                                    }
                                  >
                                    <SelectTrigger
                                      size="sm"
                                      className="w-[110px]"
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="admin">
                                        Admin
                                      </SelectItem>
                                      <SelectItem value="member">
                                        Member
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge>{member.role}</Badge>
                                )}

                                {isSelf && member.role !== "owner" ? (
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button variant="destructive" size="sm">
                                        Leave team
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Leave team</DialogTitle>
                                        <DialogDescription>
                                          Are you sure you want to leave{" "}
                                          {currentOrg.name}? You will lose
                                          access to all projects and will need
                                          to be re-invited to rejoin.
                                        </DialogDescription>
                                      </DialogHeader>
                                      <DialogFooter>
                                        <DialogClose asChild>
                                          <Button variant="outline">
                                            Cancel
                                          </Button>
                                        </DialogClose>
                                        <DialogClose asChild>
                                          <Button
                                            variant="destructive"
                                            onClick={handleLeaveTeam}
                                          >
                                            Leave team
                                          </Button>
                                        </DialogClose>
                                      </DialogFooter>
                                    </DialogContent>
                                  </Dialog>
                                ) : null}

                                {isAdmin &&
                                !isSelf &&
                                member.role !== "owner" ? (
                                  <Dialog>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon-sm">
                                          <Ellipsis />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DialogTrigger asChild>
                                          <DropdownMenuItem className="text-destructive focus:text-destructive">
                                            Remove
                                          </DropdownMenuItem>
                                        </DialogTrigger>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Remove member</DialogTitle>
                                        <DialogDescription>
                                          Remove {member.name ?? member.email}{" "}
                                          from {currentOrg.name}? They will lose
                                          access to all projects.
                                        </DialogDescription>
                                      </DialogHeader>
                                      <DialogFooter>
                                        <DialogClose asChild>
                                          <Button variant="outline">
                                            Cancel
                                          </Button>
                                        </DialogClose>
                                        <DialogClose asChild>
                                          <Button
                                            variant="destructive"
                                            onClick={() =>
                                              handleRemoveMember(member.id)
                                            }
                                          >
                                            Remove
                                          </Button>
                                        </DialogClose>
                                      </DialogFooter>
                                    </DialogContent>
                                  </Dialog>
                                ) : null}
                              </ItemActions>
                            </Item>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {/* ===== DATA SOURCES SECTION ===== */}
          {activeSection === "data-sources" && (
            <>
              <div className="mb-8">
                <Card>
                  <CardHeader>
                    <CardTitle>Data Sources</CardTitle>
                    <CardDescription>
                      Manage databases and data sources for{" "}
                      {currentOrg.name}. Connection strings are stored
                      securely and available to all projects.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {dbError && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertDescription>{dbError}</AlertDescription>
                      </Alert>
                    )}

                    {/* Add data source form */}
                    {isAdmin && !showDbForm && (
                      <div className="mb-4">
                        <Button onClick={() => setShowDbForm(true)} size="sm">
                          Add Data Source
                        </Button>
                      </div>
                    )}

                    {showDbForm && (
                      <div className="mb-6 rounded-lg border border-border p-4">
                        <div className="flex flex-col gap-4">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setDbProvider("manual")}
                              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                                dbProvider === "manual"
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-background text-muted-foreground hover:bg-muted"
                              }`}
                            >
                              Manual
                            </button>
                            <button
                              type="button"
                              onClick={() => setDbProvider("neon")}
                              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                                dbProvider === "neon"
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-background text-muted-foreground hover:bg-muted"
                              }`}
                            >
                              Neon (auto-provision)
                            </button>
                          </div>
                          <div className="flex items-center gap-3">
                            <Input
                              type="text"
                              value={dbName}
                              onChange={(e) => setDbName(e.target.value)}
                              placeholder="Data source name"
                              className="flex-1"
                            />
                            <Select
                              value={dbType}
                              onValueChange={(val) => setDbType(val)}
                            >
                              <SelectTrigger className="w-[150px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pg">PostgreSQL</SelectItem>
                                <SelectItem value="mysql">MySQL</SelectItem>
                                <SelectItem value="sqlite">SQLite</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {dbProvider === "manual" && (
                            <Input
                              type="text"
                              value={dbConnectionString}
                              onChange={(e) =>
                                setDbConnectionString(e.target.value)
                              }
                              placeholder="Connection string (e.g. postgres://user:pass@host/db)"
                              className="font-mono text-[0.8125rem]"
                            />
                          )}
                          {dbProvider === "neon" && (
                            <Muted>
                              A new Neon PostgreSQL project will be created
                              automatically. Requires NEON_API_KEY in team
                              settings.
                            </Muted>
                          )}
                          <div className="flex gap-2">
                            <Button
                              onClick={handleAddDatabase}
                              disabled={
                                savingDb ||
                                !dbName.trim() ||
                                (dbProvider === "manual" &&
                                  !dbConnectionString.trim())
                              }
                              size="sm"
                            >
                              {savingDb
                                ? dbProvider === "neon"
                                  ? "Provisioning..."
                                  : "Saving..."
                                : dbProvider === "neon"
                                  ? "Provision"
                                  : "Add"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowDbForm(false);
                                setDbError(null);
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Data sources list */}
                    {dbLoading ? (
                      <Muted className="py-4">Loading...</Muted>
                    ) : dbList.length === 0 && !showDbForm ? (
                      <div className="flex flex-col items-center gap-3 py-8">
                        <Database className="size-8 text-muted-foreground/50" />
                        <Muted>No data sources connected yet.</Muted>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {dbList.map((database) => (
                          <Item key={database.id} variant="outline" size="sm">
                            <ItemMedia variant="icon">
                              <Database className="size-4" />
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle>{database.name}</ItemTitle>
                              <ItemDescription>
                                {database.provider === "neon"
                                  ? "Neon"
                                  : "Manual"}{" "}
                                &middot; {database.type}
                              </ItemDescription>
                            </ItemContent>
                            <ItemActions>
                              <Badge
                                className={
                                  database.status === "ready"
                                    ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
                                    : database.status === "error"
                                      ? "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
                                      : "border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300"
                                }
                              >
                                {database.status}
                              </Badge>
                              {isAdmin && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="xs"
                                      className="text-destructive hover:text-destructive/80"
                                      disabled={deletingDbId === database.id}
                                    >
                                      {deletingDbId === database.id
                                        ? "Deleting..."
                                        : "Delete"}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        Delete data source
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Delete &ldquo;{database.name}&rdquo;?
                                        This is permanent
                                        {database.provider === "neon" &&
                                          " and will destroy the Neon project"}
                                        .
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <CardFooter className="border-t justify-end gap-2 -mx-6 -mb-6 mt-2">
                                      <AlertDialogCancel size="sm">
                                        Cancel
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        variant="destructive"
                                        size="sm"
                                        onClick={() =>
                                          handleDeleteDatabase(database.id)
                                        }
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </CardFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </ItemActions>
                          </Item>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function VercelIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 76 65" fill="currentColor">
      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
  );
}
