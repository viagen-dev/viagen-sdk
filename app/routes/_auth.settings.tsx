import { useState, useEffect } from "react";
import { useRouteLoaderData, useSearchParams } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";

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

interface KeyStatus {
  connected: boolean;
  scope: string;
  keyPrefix?: string;
}

export default function Settings() {
  const parentData = useRouteLoaderData("routes/_auth") as ParentData;
  const { user, currentOrg, organizations, integrations } = parentData;
  const [searchParams, setSearchParams] = useSearchParams();

  const currentRole =
    organizations.find((o) => o.id === currentOrg.id)?.role ?? "member";
  const isAdmin = currentRole === "admin";

  const [githubConnected, setGithubConnected] = useState(integrations.github);
  const [vercelConnected, setVercelConnected] = useState(integrations.vercel);

  // Claude key state
  const [userKey, setUserKey] = useState<KeyStatus | null>(null);
  const [orgKey, setOrgKey] = useState<KeyStatus | null>(null);
  const [userKeyInput, setUserKeyInput] = useState("");
  const [orgKeyInput, setOrgKeyInput] = useState("");
  const [savingUserKey, setSavingUserKey] = useState(false);
  const [savingOrgKey, setSavingOrgKey] = useState(false);

  // Clean up OAuth redirect params from URL
  useEffect(() => {
    if (searchParams.has("connected") || searchParams.has("error")) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Fetch Claude key status
  useEffect(() => {
    fetch("/api/claude-key?scope=user", { credentials: "include" })
      .then((r) => r.json())
      .then(setUserKey)
      .catch(() => {});
    fetch("/api/claude-key?scope=org", { credentials: "include" })
      .then((r) => r.json())
      .then(setOrgKey)
      .catch(() => {});
  }, []);

  const disconnectGithub = async () => {
    await fetch("/api/integrations/github", {
      method: "DELETE",
      credentials: "include",
    });
    setGithubConnected(false);
  };

  const disconnectVercel = async () => {
    await fetch("/api/integrations/vercel", {
      method: "DELETE",
      credentials: "include",
    });
    setVercelConnected(false);
  };

  const saveUserKey = async () => {
    if (!userKeyInput.trim()) return;
    setSavingUserKey(true);
    await fetch("/api/claude-key", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: userKeyInput.trim(), scope: "user" }),
    });
    const res = await fetch("/api/claude-key?scope=user", {
      credentials: "include",
    });
    setUserKey(await res.json());
    setUserKeyInput("");
    setSavingUserKey(false);
  };

  const removeUserKey = async () => {
    setSavingUserKey(true);
    await fetch("/api/claude-key?scope=user", {
      method: "DELETE",
      credentials: "include",
    });
    setUserKey({ connected: false, scope: "user" });
    setSavingUserKey(false);
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
      <h1 className="mb-2 text-3xl font-semibold">Settings</h1>
      <p className="mb-8 text-[0.9375rem] text-muted-foreground">
        Manage your account and preferences
      </p>

      {/* Profile */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Profile</h2>
        <Card>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="profile-name" className="text-foreground/70">
                Name
              </Label>
              <Input
                id="profile-name"
                type="text"
                defaultValue={user.name ?? ""}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email" className="text-foreground/70">
                Email
              </Label>
              <Input
                id="profile-email"
                type="email"
                defaultValue={user.email}
                placeholder="your@email.com"
              />
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>
      </div>

      {/* Integrations */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Integrations</h2>

        {/* GitHub */}
        <Card className="mb-4">
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GitHubIcon />
                <div>
                  <p className="text-[0.9375rem] font-medium">GitHub</p>
                  <p className="text-[0.8125rem] text-muted-foreground">
                    Connect your GitHub account to access your repositories
                  </p>
                </div>
              </div>
              {githubConnected ? (
                <div className="flex items-center gap-3">
                  <Badge className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
                    Connected
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={disconnectGithub}
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button asChild>
                  <a href="/api/integrations/github/start?return_to=/settings">
                    Connect
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Vercel */}
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <VercelIcon />
                <div>
                  <p className="text-[0.9375rem] font-medium">Vercel</p>
                  <p className="text-[0.8125rem] text-muted-foreground">
                    Connect your Vercel account to deploy projects
                  </p>
                </div>
              </div>
              {vercelConnected ? (
                <div className="flex items-center gap-3">
                  <Badge className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
                    Connected
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={disconnectVercel}
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button asChild>
                  <a href="/api/integrations/vercel/start?return_to=/settings">
                    Connect
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Claude / Anthropic */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Claude / Anthropic</h2>
        <p className="mb-4 -mt-2 text-[0.8125rem] text-muted-foreground">
          API keys are resolved per project in priority order: project &gt;
          organization &gt; personal.
        </p>

        {/* Personal key */}
        <Card className="mb-4">
          <CardContent>
            <div
              className={`flex items-center justify-between ${userKey?.connected ? "mb-3" : ""}`}
            >
              <div>
                <p className="text-[0.9375rem] font-medium">Personal Key</p>
                <p className="text-[0.8125rem] text-muted-foreground">
                  Your personal Anthropic API key. Used as fallback when no org
                  or project key is set.
                </p>
              </div>
              {userKey?.connected && (
                <div className="flex items-center gap-3">
                  <Badge className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
                    {userKey.keyPrefix}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={removeUserKey}
                    disabled={savingUserKey}
                  >
                    Remove
                  </Button>
                </div>
              )}
            </div>
            {!userKey?.connected && (
              <div className="mt-3 flex gap-2">
                <Input
                  type="password"
                  value={userKeyInput}
                  onChange={(e) => setUserKeyInput(e.target.value)}
                  placeholder="sk-ant-api..."
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && saveUserKey()}
                />
                <Button
                  onClick={saveUserKey}
                  disabled={!userKeyInput.trim() || savingUserKey}
                >
                  {savingUserKey ? "Saving..." : "Save"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Organization key */}
        <Card>
          <CardContent>
            <div
              className={`flex items-center justify-between ${orgKey?.connected ? "mb-3" : ""}`}
            >
              <div>
                <p className="text-[0.9375rem] font-medium">Organization Key</p>
                <p className="text-[0.8125rem] text-muted-foreground">
                  Shared key for all projects in {currentOrg.name}. Overrides
                  personal keys.
                </p>
              </div>
              {orgKey?.connected && (
                <div className="flex items-center gap-3">
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
              <p className="mt-3 text-[0.8125rem] italic text-muted-foreground">
                Only admins can set the organization key.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* API Keys */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">API Keys</h2>
        <Card>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Manage your API keys for authentication
            </p>
            <Button variant="outline">Generate New Key</Button>
          </CardContent>
        </Card>
      </div>

      {/* Danger Zone */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Danger Zone</h2>
        <Card className="border-destructive bg-destructive/5">
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="mb-1 text-[0.9375rem] font-semibold text-destructive">
                  Delete Account
                </h3>
                <p className="text-[0.8125rem] text-destructive/80">
                  Permanently delete your account and all associated data
                </p>
              </div>
              <Button variant="destructive">Delete Account</Button>
            </div>
          </CardContent>
        </Card>
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
