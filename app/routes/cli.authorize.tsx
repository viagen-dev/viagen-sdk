import { redirect, useLoaderData } from "react-router";
import { useState } from "react";
import { getSessionUser, requireUser } from "~/lib/session.server";
import { createApiToken } from "~/lib/auth.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    }),
  );
}

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const portStr = url.searchParams.get("port");
  const port = portStr ? parseInt(portStr, 10) : NaN;

  if (isNaN(port) || port < 1024 || port > 65535) {
    return Response.json({ error: "Invalid port" }, { status: 400 });
  }

  // Check invite code (via cookie or query param)
  const cookies = parseCookies(request.headers.get("Cookie"));
  const inviteCode = url.searchParams.get("inviteCode");
  let hasInvite = cookies["viagen-invite"] === "1";

  const validCodes = (process.env.INVITE_CODES ?? "")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

  if (!hasInvite && inviteCode && validCodes.length > 0) {
    hasInvite = validCodes.includes(inviteCode.trim().toLowerCase());
    if (hasInvite) {
      console.log(`[invite] CLI invite code accepted: ${inviteCode}`);
    }
  }

  // No codes configured = no gate
  if (validCodes.length === 0) hasInvite = true;

  if (!hasInvite) {
    return { needsInvite: true as const, port };
  }

  const session = await getSessionUser(request);
  if (!session) {
    const returnTo = encodeURIComponent(`/cli/authorize?port=${port}`);
    throw redirect(`/login?returnTo=${returnTo}`);
  }

  return {
    needsInvite: false as const,
    user: { name: session.user.name, email: session.user.email },
    port,
  };
}

export async function action({ request }: { request: Request }) {
  const { user } = await requireUser(request);
  const formData = await request.formData();
  const portStr = formData.get("port");
  const port = portStr ? parseInt(String(portStr), 10) : NaN;

  if (isNaN(port) || port < 1024 || port > 65535) {
    return Response.json({ error: "Invalid port" }, { status: 400 });
  }

  const { token } = await createApiToken(
    user.id,
    `cli-${new Date().toISOString().slice(0, 10)}`,
  );

  return redirect(`http://127.0.0.1:${port}/callback?token=${token}`);
}

export default function CliAuthorize() {
  const data = useLoaderData<typeof loader>();

  if ("needsInvite" in data && data.needsInvite) {
    return <InviteGate port={data.port} />;
  }

  const { user, port } = data as {
    needsInvite: false;
    user: { name: string | null; email: string };
    port: number;
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center">
      <h1 className="text-2xl font-medium">viagen</h1>
      <p className="mb-6 mt-2 text-base font-medium">Authorize CLI access?</p>

      <Card className="mb-6 w-full max-w-[360px] text-center">
        <CardHeader>
          <CardTitle className="text-sm font-normal">
            Signed in as <strong>{user.name ?? user.email}</strong>
          </CardTitle>
          {user.name && <CardDescription>{user.email}</CardDescription>}
        </CardHeader>
        <CardContent>
          <p className="text-[0.8125rem] text-muted-foreground">
            This will create an API token for the viagen CLI on your machine.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-col items-center gap-3">
        <form method="post">
          <input type="hidden" name="port" value={port} />
          <Button type="submit" size="lg">
            Authorize
          </Button>
        </form>
        <Button variant="link" asChild>
          <a
            href={`http://127.0.0.1:${port}/callback?error=denied`}
            className="text-muted-foreground"
          >
            Cancel
          </a>
        </Button>
      </div>
    </div>
  );
}

function InviteGate({ port }: { port: number }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Invalid code");
        return;
      }
      window.location.reload();
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center">
      <h1 className="text-2xl font-medium">viagen</h1>
      <p className="mb-6 mt-2 text-base font-medium">CLI Authorization</p>
      <form onSubmit={handleSubmit} className="flex w-[260px] flex-col gap-2.5">
        <Input
          type="text"
          placeholder="Enter invite code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
        />
        {error && (
          <p className="text-center text-sm text-destructive">{error}</p>
        )}
        <Button type="submit" disabled={submitting || !code.trim()}>
          {submitting ? "Checking…" : "Continue"}
        </Button>
      </form>
      <Button variant="link" asChild className="mt-3">
        <a
          href={`http://127.0.0.1:${port}/callback?error=denied`}
          className="text-muted-foreground"
        >
          Cancel
        </a>
      </Button>
    </div>
  );
}
