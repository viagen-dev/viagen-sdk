import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { redirect } from "react-router";
import { getSessionUser } from "~/lib/session.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import {
  Field,
  FieldLabel,
  FieldContent,
  FieldTitle,
  FieldDescription,
} from "~/components/ui/field";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "~/components/ui/card";

export async function loader({ request }: { request: Request }) {
  const session = await getSessionUser(request);
  if (!session) return redirect("/login");

  return {
    hasOrg: session.memberships.length > 0,
    orgId: session.memberships[0]?.organizationId ?? null,
  };
}

export default function Onboarding({
  loaderData,
}: {
  loaderData: { hasOrg: boolean; orgId: string | null };
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasOrg } = loaderData;

  // If user already has an org and didn't explicitly ask to create a new team,
  // redirect them to the projects page
  const newTeam = searchParams.get("new_team");
  if (hasOrg && newTeam !== "true" && typeof window !== "undefined") {
    navigate("/", { replace: true });
    return null;
  }

  const handleOrgCreated = (orgId: string) => {
    document.cookie = `viagen-org=${orgId}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    // Full reload so the _auth layout re-runs with the new org's integration status
    window.location.href = "/";
  };

  const handleCancel = () => {
    navigate("/", { replace: true });
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center">
      <div className="w-full max-w-[480px] p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Create your team
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Unlock collaboration and organize projects.
          </p>
        </div>

        <TeamStep
          onNext={handleOrgCreated}
          onCancel={handleCancel}
          showCancel={hasOrg}
        />
      </div>
    </div>
  );
}

/* ─── Team Name + Plan Step ──────────────────────────────────────────── */

function TeamStep({
  onNext,
  onCancel,
  showCancel,
}: {
  onNext: (orgId: string) => void;
  onCancel: () => void;
  showCancel: boolean;
}) {
  const [name, setName] = useState("");
  const [plan, setPlan] = useState<"pro_trial">("pro_trial");
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
      const data = await res.json();
      onNext(data.organization.id);
    } catch {
      setError("Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team name</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Input
            id="team-name"
            type="text"
            placeholder="Acme Inc."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label>Plan</Label>
          <RadioGroup
            value={plan}
            onValueChange={(v) => setPlan(v as "pro_trial")}
          >
            <FieldLabel className="has-data-[state=checked]:bg-blue-50 has-data-[state=checked]:border-blue-500 has-data-[state=checked]:text-blue-600 dark:has-data-[state=checked]:bg-blue-950/20 dark:has-data-[state=checked]:border-blue-400 dark:has-data-[state=checked]:text-blue-400">
              <Field orientation="horizontal">
                <RadioGroupItem
                  value="pro_trial"
                  id="pro_trial"
                  className="text-blue-500 border-blue-500 data-[state=checked]:border-blue-500 dark:text-blue-400 dark:border-blue-400 [&_svg]:fill-blue-500 dark:[&_svg]:fill-blue-400"
                />
                <FieldContent>
                  <FieldTitle>Pro Trial</FieldTitle>
                  <FieldDescription className="text-blue-500 dark:text-blue-300">
                    Try all the Pro features free for 14 days
                  </FieldDescription>
                </FieldContent>
              </Field>
            </FieldLabel>
          </RadioGroup>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="border-t flex-col gap-2">
        <Button
          onClick={handleCreate}
          disabled={creating || !name.trim()}
          className="w-full"
        >
          {creating ? "Creating..." : "Create team"}
        </Button>
        {showCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="w-full text-muted-foreground"
          >
            Cancel
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
