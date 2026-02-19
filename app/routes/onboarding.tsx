import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { redirect } from "react-router";
import { getSessionUser } from "~/lib/session.server";
import { cn } from "~/lib/utils";

export async function loader({ request }: { request: Request }) {
  const session = await getSessionUser(request);
  if (!session) return redirect("/login");

  return {
    hasOrg: session.memberships.length > 0,
    orgId: session.memberships[0]?.organizationId ?? null,
  };
}

type Step = "team" | "github" | "vercel" | "done";
const STEP_KEY = "viagen-onboarding-step";

export default function Onboarding({
  loaderData,
}: {
  loaderData: { hasOrg: boolean; orgId: string | null };
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasOrg, orgId } = loaderData;

  const getInitialStep = (): Step => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected === "vercel") return "done";
    if (error === "vercel") return "vercel";
    if (connected === "github") return "vercel";
    if (error === "github") return "github";
    if (hasOrg) {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(STEP_KEY);
        if (saved === "github" || saved === "vercel") return saved;
      }
      return "github";
    }
    return "team";
  };

  const [step, setStep] = useState<Step>(getInitialStep);

  useEffect(() => {
    if (searchParams.has("connected") || searchParams.has("error")) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (step !== "team") localStorage.setItem(STEP_KEY, step);
  }, [step]);

  const finish = () => {
    localStorage.removeItem(STEP_KEY);
    navigate("/", { replace: true });
  };

  useEffect(() => {
    if (step === "done") finish();
  }, [step]);

  const handleOrgCreated = async () => {
    setStep("github");
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center">
      <div className="w-full max-w-[400px] p-8">
        <div className="mb-8 flex items-center justify-center gap-2">
          <StepDot active={step === "team"} done={step !== "team"} label="1" />
          <div className="h-px w-10 bg-border" />
          <StepDot
            active={step === "github"}
            done={step === "vercel"}
            label="2"
          />
          <div className="h-px w-10 bg-border" />
          <StepDot active={step === "vercel"} done={false} label="3" />
        </div>

        {step === "team" && <TeamStep onNext={handleOrgCreated} />}
        {step === "github" && (
          <GitHubStep
            githubError={searchParams.get("error") === "github"}
            onSkip={() => setStep("vercel")}
          />
        )}
        {step === "vercel" && (
          <VercelStep
            vercelError={searchParams.get("error") === "vercel"}
            onSkip={finish}
          />
        )}

        <button
          onClick={handleLogout}
          className="mt-8 block w-full cursor-pointer border-none bg-transparent p-2 text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function TeamStep({ onNext }: { onNext: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/orgs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to create team");
        return;
      }
      await onNext();
    } catch {
      setError("Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <h1 className="mb-2 text-center text-2xl font-semibold">
        Create your team
      </h1>
      <p className="mb-8 text-center text-sm leading-relaxed text-muted-foreground">
        Teams let you organize projects and collaborate with others.
      </p>
      <div className="mb-6">
        <label className="mb-2 block text-sm font-medium text-foreground/70">
          Team name
        </label>
        <input
          type="text"
          placeholder="Acme Inc."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          autoFocus
        />
      </div>
      {error && (
        <p className="mb-4 text-center text-[0.8125rem] text-destructive">
          {error}
        </p>
      )}
      <button
        onClick={handleCreate}
        disabled={creating || !name.trim()}
        className={cn(
          "w-full cursor-pointer rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:bg-primary/90",
          (creating || !name.trim()) && "cursor-not-allowed opacity-50",
        )}
      >
        {creating ? "Creating..." : "Continue"}
      </button>
    </>
  );
}

function GitHubStep({
  githubError,
  onSkip,
}: {
  githubError: boolean;
  onSkip: () => void;
}) {
  return (
    <>
      <h1 className="mb-2 text-center text-2xl font-semibold">
        Connect GitHub
      </h1>
      <p className="mb-8 text-center text-sm leading-relaxed text-muted-foreground">
        Link your GitHub account so viagen can access your repositories and save
        sandbox changes.
      </p>
      {githubError && (
        <p className="mb-4 text-center text-[0.8125rem] text-destructive">
          Failed to connect GitHub. Please try again.
        </p>
      )}
      <a
        href="/api/integrations/github/start"
        className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground no-underline transition-opacity hover:bg-primary/90"
      >
        Connect GitHub
      </a>
      <button
        onClick={onSkip}
        className="mt-4 block w-full cursor-pointer border-none bg-transparent p-2 text-center text-[0.8125rem] text-muted-foreground underline hover:text-foreground"
      >
        Skip for now
      </button>
    </>
  );
}

function VercelStep({
  vercelError,
  onSkip,
}: {
  vercelError: boolean;
  onSkip: () => void;
}) {
  return (
    <>
      <h1 className="mb-2 text-center text-2xl font-semibold">
        Connect Vercel
      </h1>
      <p className="mb-8 text-center text-sm leading-relaxed text-muted-foreground">
        Link your Vercel account to deploy projects and manage environments.
      </p>
      {vercelError && (
        <p className="mb-4 text-center text-[0.8125rem] text-destructive">
          Failed to connect Vercel. Please try again.
        </p>
      )}
      <a
        href="/api/integrations/vercel/start"
        className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground no-underline transition-opacity hover:bg-primary/90"
      >
        Connect Vercel
      </a>
      <button
        onClick={onSkip}
        className="mt-4 block w-full cursor-pointer border-none bg-transparent p-2 text-center text-[0.8125rem] text-muted-foreground underline hover:text-foreground"
      >
        Skip for now
      </button>
    </>
  );
}

function StepDot({
  active,
  done,
  label,
}: {
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <div
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all",
        active || done
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-muted-foreground",
      )}
    >
      {done ? "\u2713" : label}
    </div>
  );
}
