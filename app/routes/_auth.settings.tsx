import { useState } from "react";
import { SidebarToggle } from "~/components/sidebar-toggle";
import { useRouteLoaderData, useNavigate } from "react-router";
import { toast } from "sonner";
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
import { Muted } from "~/components/ui/typography";

interface ParentData {
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
  currentOrg: { id: string; name: string };
  organizations: { id: string; name: string; role: string }[];
  integrations: { github: boolean; vercel: boolean; claude: boolean };
}

export default function Settings() {
  const parentData = useRouteLoaderData("routes/_auth") as ParentData;
  const { user } = parentData;
  const navigate = useNavigate();

  // --- Profile state ---
  const [displayName, setDisplayName] = useState(user.name ?? "");
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const displayNameChanged = displayName.trim() !== (user.name ?? "");

  const [email, setEmail] = useState(user.email);
  const [savingEmail, setSavingEmail] = useState(false);
  const emailChanged = email.trim() !== user.email;

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

  return (
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden">
      <div className="flex items-center h-14 px-4 border-b shrink-0 gap-2">
        <SidebarToggle />
        <h1 className="text-base font-semibold">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-[960px]">
          {/* Display Name */}
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
                    e.key === "Enter" && displayNameChanged && saveDisplayName()
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

          {/* Email */}
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

          {/* Delete Account — danger zone */}
          <div className="mb-8">
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle>Delete Account</CardTitle>
                <CardDescription>
                  Permanently remove your personal account and all of its
                  contents. This action is not reversible, so please continue
                  with caution.
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
                        delete your account and remove all of your data from our
                        servers.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={async () => {
                          try {
                            const res = await fetch("/api/auth/profile", {
                              method: "DELETE",
                              credentials: "include",
                            });
                            if (!res.ok) {
                              const data = await res.json().catch(() => ({}));
                              toast.error(
                                data.error ?? "Failed to delete account",
                              );
                              return;
                            }
                            document.cookie = "viagen-org=; path=/; max-age=0";
                            toast.success("Account deleted");
                            navigate("/login");
                          } catch {
                            toast.error("Failed to delete account");
                          }
                        }}
                      >
                        Delete Account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
