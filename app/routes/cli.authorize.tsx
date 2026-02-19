import { redirect, useLoaderData } from "react-router";
import { getSessionUser, requireUser } from "~/lib/session.server";
import { createApiToken } from "~/lib/auth.server";

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const portStr = url.searchParams.get("port");
  const port = portStr ? parseInt(portStr, 10) : NaN;

  if (isNaN(port) || port < 1024 || port > 65535) {
    return Response.json({ error: "Invalid port" }, { status: 400 });
  }

  const session = await getSessionUser(request);
  if (!session) {
    const returnTo = encodeURIComponent(`/cli/authorize?port=${port}`);
    throw redirect(`/login?returnTo=${returnTo}`);
  }

  return { user: { name: session.user.name, email: session.user.email }, port };
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
  const { user, port } = useLoaderData<typeof loader>();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center">
      <h1 className="text-2xl font-medium">viagen</h1>
      <p className="mb-6 mt-2 text-base font-medium">Authorize CLI access?</p>
      <div className="mb-6 w-full max-w-[360px] rounded-lg border border-border p-5 text-center">
        <p className="text-sm">
          Signed in as <strong>{user.name ?? user.email}</strong>
        </p>
        {user.name && (
          <p className="mt-1 text-[0.8125rem] text-muted-foreground">
            {user.email}
          </p>
        )}
        <p className="mt-4 text-[0.8125rem] text-muted-foreground">
          This will create an API token for the viagen CLI on your machine.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <form method="post">
          <input type="hidden" name="port" value={port} />
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-primary px-8 py-2.5 text-[0.8125rem] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Authorize
          </button>
        </form>
        <a
          href={`http://127.0.0.1:${port}/callback?error=denied`}
          className="text-[0.8125rem] text-muted-foreground no-underline hover:text-foreground"
        >
          Cancel
        </a>
      </div>
    </div>
  );
}
