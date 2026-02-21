import { useRouteLoaderData } from "react-router";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { H3, P, Muted, Large, Small } from "~/components/ui/typography";

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

export default function Billing() {
  const parentData = useRouteLoaderData("routes/_auth") as
    | ParentData
    | undefined;
  const currentOrg = parentData?.currentOrg;

  return (
    <div className="mx-auto w-full max-w-[960px] px-6 py-8">
      <div className="mb-8">
        <H3>Billing</H3>
        <Muted>
          Manage your subscription and billing for{" "}
          <span className="font-medium text-foreground">
            {currentOrg?.name ?? "your organization"}
          </span>
          .
        </Muted>
      </div>

      {/* Current Plan */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>
                Your organization is currently on the free plan.
              </CardDescription>
            </div>
            <Badge variant="secondary">Free</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-md border p-4">
              <div>
                <Small>Free Plan</Small>
                <Muted>Basic features for individuals and small teams.</Muted>
              </div>
              <Large>
                $0<Muted className="inline text-sm font-normal">/mo</Muted>
              </Large>
            </div>
            <Button className="w-fit" disabled>
              Upgrade Plan (Coming Soon)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator className="my-6" />

      {/* Usage */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Usage</CardTitle>
          <CardDescription>
            Overview of your current usage this billing period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-md border p-4">
              <Muted>Projects</Muted>
              <Large>—</Large>
            </div>
            <div className="rounded-md border p-4">
              <Muted>Team Members</Muted>
              <Large>—</Large>
            </div>
            <div className="rounded-md border p-4">
              <Muted>Deployments</Muted>
              <Large>—</Large>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator className="my-6" />

      {/* Payment Method */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Method</CardTitle>
          <CardDescription>
            No payment method on file. Add one when you're ready to upgrade.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" disabled>
            Add Payment Method (Coming Soon)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
