import { useState, useEffect, useRef } from "react";
import { SidebarToggle } from "~/components/sidebar-toggle";
import {
  useRouteLoaderData,
  useSearchParams,
  useNavigate,
  useRevalidator,
  useLocation,
} from "react-router";
import { toast } from "sonner";
import { Ellipsis, UserRoundPlus } from "lucide-react";
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
} from "~/components/ui/alert-dialog";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Muted, Small, H3 } from "~/components/ui/typography";
import { Separator } from "~/components/ui/separator";
import {
  Item,
  ItemGroup,
  ItemSeparator,
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
import { AnthropicIcon } from "~/components/icons/anthropic-icon";

interface ParentData {
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
  currentOrg: { id: string; name: string; description: string | null };
  organizations: { id: string; name: string; role: string }[];
  integrations: { github: boolean; vercel: boolean; claude: boolean };
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

export default function MyTeamPage() {
  const parentData = useRouteLoaderData("routes/_auth") as ParentData;
  const revalidator = useRevalidator();
  const { user, currentOrg, organizations, integrations } = parentData;
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const currentRole =
    organizations.find((o) => o.id === currentOrg.id)?.role ?? "member";
  const isAdmin = currentRole === "admin" || currentRole === "owner";

  // --- Connections state ---
  const [githubConnected, setGithubConnected] = useState(integrations.github);
  const [vercelConnected, setVercelConnected] = useState(integrations.vercel);

  useEffect(() => {
    setGithubConnected(integrations.github);
    setVercelConnected(integrations.vercel);
  }, [integrations.github, integrations.vercel]);

  // --- Team name state ---
  const [orgName, setOrgName] = useState(currentOrg.name);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // --- Team description state ---
  const [orgDescription, setOrgDescription] = useState(
    currentOrg.description ?? "",
  );
  const [savingDescription, setSavingDescription] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // --- Members state ---
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);

  // --- Invite dialog state ---
  const [inviteOpen, setInviteOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // --- Org Claude key state ---
  const [orgKey, setOrgKey] = useState<KeyStatus | null>(null);
  const [orgKeyInput, setOrgKeyInput] = useState("");
  const [savingOrgKey, setSavingOrgKey] = useState(false);
  const [claudeKeyOpen, setClaudeKeyOpen] = useState(false);

  // Handle OAuth redirect
  useEffect(() => {
    const connected = searchParams.get("connected");
    if (connected) {
      if (connected === "github") setGithubConnected(true);
      if (connected === "vercel") setVercelConnected(true);
      revalidator.revalidate();
    }
    if (searchParams.has("connected") || searchParams.has("error")) {
      setSearchParams({}, { replace: true });
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

  // Scroll to hash
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    const timer = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [location.hash]);

  // --- Connections handlers ---
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

  // --- Team name handler ---
  const handleRenameOrg = async () => {
    if (!orgName.trim() || savingName) return;
    if (orgName.trim() === currentOrg.name) return;
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
        setOrgName(currentOrg.name);
        return;
      }
      toast.success("Team renamed");
    } catch {
      setNameError("Failed to rename organization");
      toast.error("Failed to rename organization");
      setOrgName(currentOrg.name);
    } finally {
      setSavingName(false);
    }
  };

  // --- Team description handler ---
  const handleSaveDescription = async () => {
    if (savingDescription) return;
    const trimmed = orgDescription.trim();
    if (trimmed === (currentOrg.description ?? "")) return;
    setSavingDescription(true);
    try {
      const res = await fetch("/api/orgs", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: trimmed || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to save description");
        setOrgDescription(currentOrg.description ?? "");
        return;
      }
      toast.success("Description saved");
    } catch {
      toast.error("Failed to save description");
      setOrgDescription(currentOrg.description ?? "");
    } finally {
      setSavingDescription(false);
    }
  };

  // --- Members handlers ---
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
      setInviteOpen(false);
      fetchMembers();
      toast.success("Member invited");
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
      const otherOrg = organizations.find((o) => o.id !== currentOrg.id);
      if (otherOrg) {
        document.cookie = `viagen-org=${otherOrg.id}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
        window.location.href = "/dashboard";
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

  // --- Claude key handlers ---
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
    setClaudeKeyOpen(false);
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

  // --- Delete team handler ---
  const [deleteTeamOpen, setDeleteTeamOpen] = useState(false);

  const handleDeleteTeam = async () => {
    try {
      const res = await fetch("/api/orgs", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: currentOrg.name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to delete team");
        return;
      }
      document.cookie = "viagen-org=; path=/; max-age=0";
      toast.success("Team deleted");
      const otherOrg = organizations.find((o) => o.id !== currentOrg.id);
      if (otherOrg) {
        document.cookie = `viagen-org=${otherOrg.id}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
        window.location.href = "/dashboard";
      } else {
        window.location.href = "/onboarding";
      }
    } catch {
      toast.error("Failed to delete team");
    }
  };

  return (
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center h-14 px-4 border-b shrink-0 gap-2">
        <SidebarToggle />
        <h1 className="text-base font-semibold">My team</h1>
        {currentRole === "owner" && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setDeleteTeamOpen(true)}
                >
                  Delete team
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={deleteTeamOpen} onOpenChange={setDeleteTeamOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete{" "}
                    <strong>{currentOrg.name}</strong> and all of its apps,
                    workspaces, members, and data sources. This action cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={handleDeleteTeam}
                  >
                    Delete Team
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-10 flex flex-col gap-8">
          {/* ── Team name ─────────────────────────────────────────── */}
          <div className="flex flex-col gap-6">
            <Small className="text-muted-foreground">Team name</Small>
            <input
              ref={nameRef}
              type="text"
              value={orgName}
              placeholder="Team name…"
              disabled={!isAdmin || savingName}
              onChange={(e) => setOrgName(e.target.value)}
              onFocus={() => setOrgName(orgName || currentOrg.name)}
              onBlur={() => {
                const trimmed = orgName.trim();
                if (trimmed !== currentOrg.name && trimmed) {
                  handleRenameOrg();
                } else {
                  setOrgName(currentOrg.name);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
                if (e.key === "Escape") {
                  setOrgName(currentOrg.name);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-full border-0 bg-transparent px-0 text-2xl font-semibold shadow-none leading-snug focus:outline-none focus-visible:outline-none placeholder:text-muted-foreground/40 placeholder:font-normal disabled:opacity-50 disabled:cursor-default"
            />
            {nameError && (
              <Muted className="mt-1 text-destructive">{nameError}</Muted>
            )}
            <textarea
              ref={descriptionRef}
              value={orgDescription}
              placeholder="Add description"
              disabled={!isAdmin || savingDescription}
              onChange={(e) => {
                setOrgDescription(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
              onFocus={(e) => {
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
              onBlur={() => {
                handleSaveDescription();
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOrgDescription(currentOrg.description ?? "");
                  (e.target as HTMLTextAreaElement).blur();
                }
              }}
              rows={1}
              className="w-full resize-none overflow-hidden border-0 bg-transparent px-0 text-base font-normal shadow-none leading-normal focus:outline-none focus-visible:outline-none placeholder:text-muted-foreground/40 disabled:opacity-50 disabled:cursor-default"
            />
          </div>

          <Separator />

          {/* ── Connections ───────────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            <H3 className="text-base">Connections</H3>
            <div className="flex flex-col gap-2">
              {/* GitHub */}
              <Item variant="outline" size="sm">
                <ItemMedia>
                  <GitHubIcon className="size-4 text-foreground" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Github</ItemTitle>
                  <ItemDescription>
                    Connect GitHub to access repositories.
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
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
                  ) : isAdmin ? (
                    <Button size="sm" asChild>
                      <a href="/api/integrations/github/start?return_to=/teams">
                        Connect
                      </a>
                    </Button>
                  ) : (
                    <Muted>Not connected</Muted>
                  )}
                </ItemActions>
              </Item>

              {/* Vercel */}
              <Item variant="outline" size="sm">
                <ItemMedia>
                  <VercelIcon className="size-4 text-foreground" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Vercel</ItemTitle>
                  <ItemDescription>
                    Connect Vercel to deploy projects.
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
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
                  ) : isAdmin ? (
                    <Button size="sm" asChild>
                      <a href="/api/integrations/vercel/start?return_to=/teams">
                        Connect
                      </a>
                    </Button>
                  ) : (
                    <Muted>Not connected</Muted>
                  )}
                </ItemActions>
              </Item>

              {/* Claude */}
              <Item variant="outline" size="sm">
                <ItemMedia>
                  <AnthropicIcon className="size-4 text-foreground" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Claude</ItemTitle>
                  <ItemDescription>
                    Shared Anthropic API key for all projects.
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  {orgKey?.connected ? (
                    <>
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
                    </>
                  ) : isAdmin ? (
                    <Dialog
                      open={claudeKeyOpen}
                      onOpenChange={setClaudeKeyOpen}
                    >
                      <DialogTrigger asChild>
                        <Button size="sm">Connect</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Claude API key</DialogTitle>
                          <DialogDescription>
                            Enter a shared Anthropic API key for all projects in{" "}
                            {currentOrg.name}. Individual projects can override
                            with their own key.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-2">
                          <Input
                            type="password"
                            value={orgKeyInput}
                            onChange={(e) => setOrgKeyInput(e.target.value)}
                            placeholder="sk-ant-api..."
                            onKeyDown={(e) => e.key === "Enter" && saveOrgKey()}
                            autoFocus
                          />
                        </div>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                          </DialogClose>
                          <Button
                            onClick={saveOrgKey}
                            disabled={!orgKeyInput.trim() || savingOrgKey}
                          >
                            {savingOrgKey ? "Saving..." : "Save"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  ) : (
                    <Muted>Not connected</Muted>
                  )}
                </ItemActions>
              </Item>
            </div>
          </div>

          <Separator />

          {/* ── Team members ──────────────────────────────────────── */}
          <div id="team-members" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <H3 className="text-base">Team members</H3>
              {isAdmin && (
                <Dialog
                  open={inviteOpen}
                  onOpenChange={(o) => {
                    setInviteOpen(o);
                    if (!o) {
                      setAddEmail("");
                      setAddError(null);
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 shadow-none"
                    >
                      <UserRoundPlus className="size-3.5" />
                      Invite
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Invite a team member</DialogTitle>
                      <DialogDescription>
                        Send an invite to someone to join {currentOrg.name}.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-2 flex flex-col gap-2">
                      {addError && (
                        <Alert variant="destructive">
                          <AlertDescription>{addError}</AlertDescription>
                        </Alert>
                      )}
                      <Input
                        type="email"
                        value={addEmail}
                        onChange={(e) => setAddEmail(e.target.value)}
                        placeholder="user@example.com"
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleAddMember()
                        }
                        autoFocus
                      />
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button
                        onClick={handleAddMember}
                        disabled={!addEmail.trim() || adding}
                      >
                        {adding ? "Inviting..." : "Send invite"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {membersError && (
              <Alert variant="destructive">
                <AlertDescription>{membersError}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-2">
              {membersLoading ? (
                <Item variant="outline" size="sm">
                  <ItemContent>
                    <Muted>Loading...</Muted>
                  </ItemContent>
                </Item>
              ) : members.length === 0 ? (
                <Item variant="outline" size="sm">
                  <ItemContent>
                    <Muted>No members found.</Muted>
                  </ItemContent>
                </Item>
              ) : (
                members.map((member) => {
                  const isSelf = member.id === user.id;
                  return (
                    <Item key={member.id} variant="outline" size="sm">
                      {/* Avatar */}
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

                      {/* Name / email */}
                      <ItemContent>
                        <ItemTitle>
                          {member.name ?? member.email}
                          {isSelf && (
                            <Small className="font-normal text-muted-foreground">
                              (you)
                            </Small>
                          )}
                        </ItemTitle>
                        {member.name && (
                          <ItemDescription className="text-xs">
                            {member.email}
                          </ItemDescription>
                        )}
                      </ItemContent>

                      {/* Role select or badge + actions */}
                      <ItemActions>
                        {isAdmin && !isSelf && member.role !== "owner" ? (
                          <Select
                            value={member.role}
                            onValueChange={(val) =>
                              handleRoleChange(member.id, val)
                            }
                          >
                            <SelectTrigger size="sm" className="w-[110px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="member">Member</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge
                            className={
                              member.role === "owner"
                                ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-600"
                                : ""
                            }
                          >
                            {member.role.charAt(0).toUpperCase() +
                              member.role.slice(1)}
                          </Badge>
                        )}

                        {isSelf && member.role !== "owner" ? (
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
                                    Leave team
                                  </DropdownMenuItem>
                                </DialogTrigger>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Leave team</DialogTitle>
                                <DialogDescription>
                                  Are you sure you want to leave{" "}
                                  {currentOrg.name}? You will lose access to all
                                  apps and will need to be re-invited to rejoin.
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <DialogClose asChild>
                                  <Button variant="outline">Cancel</Button>
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
                        ) : isAdmin && !isSelf && member.role !== "owner" ? (
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
                                  Remove {member.name ?? member.email} from{" "}
                                  {currentOrg.name}? They will lose access to
                                  all apps.
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <DialogClose asChild>
                                  <Button variant="outline">Cancel</Button>
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
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function VercelIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 76 65" fill="currentColor" className={className}>
      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
  );
}
