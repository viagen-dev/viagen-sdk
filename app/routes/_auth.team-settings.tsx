import { useState, useEffect } from "react";
import { useRouteLoaderData } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
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

export default function TeamSettings() {
  const parentData = useRouteLoaderData("routes/_auth") as ParentData;
  const { user, currentOrg, organizations } = parentData;
  const currentRole =
    organizations.find((o) => o.id === currentOrg.id)?.role ?? "member";
  const isAdmin = currentRole === "admin";

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
    fetch("/api/claude-key?scope=org", { credentials: "include" })
      .then((r) => r.json())
      .then(setOrgKey)
      .catch(() => {});
  }, []);

  // Handlers
  const handleRenamOrg = async () => {
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
    } catch {
      setNameError("Failed to rename organization");
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
    } catch {
      setAddError("Failed to add member");
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
    } catch {
      setMembersError("Failed to remove member");
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
    } catch {
      setMembersError("Failed to update role");
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
  };

  const removeOrgKey = async () => {
    setSavingOrgKey(true);
    await fetch("/api/claude-key?scope=org", {
      method: "DELETE",
      credentials: "include",
    });
    setOrgKey({ connected: false, scope: "org" });
    setSavingOrgKey(false);
  };

  return (
    <div>
      <h1 className="mb-2 text-3xl font-semibold">Team Settings</h1>
      <p className="mb-8 text-[0.9375rem] text-muted-foreground">
        Manage your organization and team members
      </p>

      {/* Rename Organization */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Organization</h2>
        <Card>
          <CardContent>
            {isAdmin ? (
              <>
                <div className="flex items-center gap-3">
                  <Input
                    type="text"
                    value={orgName}
                    onChange={(e) => {
                      setOrgName(e.target.value);
                      setNameSaved(false);
                      setNameError(null);
                    }}
                    placeholder="Organization name"
                    className="flex-1"
                    onKeyDown={(e) =>
                      e.key === "Enter" && nameChanged && handleRenamOrg()
                    }
                  />
                  <Button
                    onClick={handleRenamOrg}
                    disabled={!nameChanged || !orgName.trim() || savingName}
                  >
                    {savingName ? "Saving..." : nameSaved ? "Saved" : "Save"}
                  </Button>
                </div>
                {nameError && (
                  <p className="mt-2 text-sm text-destructive">{nameError}</p>
                )}
              </>
            ) : (
              <p className="text-[0.9375rem] font-medium">{currentOrg.name}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Organization Claude Key */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Organization Claude Key</h2>
        <Card>
          <CardContent>
            <div
              className={`flex items-center justify-between ${orgKey?.connected ? "mb-3" : ""}`}
            >
              <div>
                <p className="text-[0.8125rem] text-muted-foreground">
                  Shared Anthropic API key for all projects in{" "}
                  {currentOrg.name}. Overrides personal keys.
                </p>
              </div>
              {orgKey?.connected && (
                <div className="flex shrink-0 items-center gap-3">
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
                </div>
              )}
            </div>
            {!orgKey?.connected && isAdmin && (
              <div className="mt-3 flex gap-2">
                <Input
                  type="password"
                  value={orgKeyInput}
                  onChange={(e) => setOrgKeyInput(e.target.value)}
                  placeholder="sk-ant-api..."
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && saveOrgKey()}
                />
                <Button
                  onClick={saveOrgKey}
                  disabled={!orgKeyInput.trim() || savingOrgKey}
                >
                  {savingOrgKey ? "Saving..." : "Save"}
                </Button>
              </div>
            )}
            {!orgKey?.connected && !isAdmin && (
              <p className="text-[0.8125rem] italic text-muted-foreground">
                Only admins can set the organization key.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Members */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Members</h2>
        <Card>
          <CardContent>
            {membersError && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{membersError}</AlertDescription>
              </Alert>
            )}

            {/* Add member form */}
            {isAdmin && (
              <div className="mb-4 border-b border-border pb-4">
                {addError && (
                  <Alert variant="destructive" className="mb-3">
                    <AlertDescription>{addError}</AlertDescription>
                  </Alert>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    type="email"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="flex-1"
                    onKeyDown={(e) => e.key === "Enter" && handleAddMember()}
                  />
                  <Button
                    onClick={handleAddMember}
                    disabled={!addEmail.trim() || adding}
                    size="sm"
                  >
                    {adding ? "Adding..." : "Add"}
                  </Button>
                </div>
              </div>
            )}

            {/* Member list */}
            {membersLoading ? (
              <p className="py-4 text-sm text-muted-foreground">Loading...</p>
            ) : members.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                No members found.
              </p>
            ) : (
              <div className="flex flex-col">
                {members.map((member) => {
                  const isSelf = member.id === user.id;
                  return (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 border-b border-border/50 py-3 last:border-b-0"
                    >
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
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {member.name ?? member.email}
                          {isSelf && (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              (you)
                            </span>
                          )}
                        </p>
                        {member.name && (
                          <p className="truncate text-xs text-muted-foreground">
                            {member.email}
                          </p>
                        )}
                      </div>

                      {isAdmin && !isSelf ? (
                        <Select
                          value={member.role}
                          onValueChange={(val) =>
                            handleRoleChange(member.id, val)
                          }
                        >
                          <SelectTrigger className="w-[110px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline">{member.role}</Badge>
                      )}

                      {isAdmin && !isSelf ? (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive/80"
                            >
                              Remove
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Remove member</DialogTitle>
                              <DialogDescription>
                                Remove {member.name ?? member.email} from{" "}
                                {currentOrg.name}? They will lose access to all
                                projects.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button variant="outline">Cancel</Button>
                              </DialogClose>
                              <DialogClose asChild>
                                <Button
                                  variant="destructive"
                                  onClick={() => handleRemoveMember(member.id)}
                                >
                                  Remove
                                </Button>
                              </DialogClose>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      ) : (
                        <div className="w-[72px]" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
