import { useState, useEffect, useCallback } from "react";
import { useRouteLoaderData } from "react-router";
import { toast } from "sonner";
import { Database, Plus, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
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
import { Muted } from "~/components/ui/typography";
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "~/components/ui/item";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface ParentData {
  user: { id: string; email: string; name: string | null; avatarUrl: string | null };
  currentOrg: { id: string; name: string };
  organizations: { id: string; name: string; role: string }[];
  integrations: { github: boolean; vercel: boolean; claude: boolean };
}

interface DatabaseInfo {
  id: string;
  name: string;
  type: string;
  provider: string;
  status: string;
  createdAt: string;
}

interface DiscoveredSource {
  projectId: string | null;
  projectName: string | null;
  key: string;
  maskedValue: string;
}

// Unified row: either a managed DB or a discovered secret
type DataSourceRow =
  | { kind: "managed"; db: DatabaseInfo }
  | { kind: "discovered"; source: DiscoveredSource };

export default function DataSources() {
  const parentData = useRouteLoaderData("routes/_auth") as ParentData;
  const { currentOrg, organizations } = parentData;

  const currentRole =
    organizations.find((o) => o.id === currentOrg.id)?.role ?? "member";
  const isAdmin = currentRole === "admin" || currentRole === "owner";

  const [dbList, setDbList] = useState<DatabaseInfo[]>([]);
  const [discovered, setDiscovered] = useState<DiscoveredSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [provider, setProvider] = useState<"manual" | "neon">("manual");
  const [dbName, setDbName] = useState("");
  const [dbType, setDbType] = useState("pg");
  const [connectionString, setConnectionString] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAndScan = useCallback(() => {
    setLoading(true);
    fetch("/api/databases?scan=true", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setDbList(data.databases ?? []);
        setDiscovered(data.discovered ?? []);
      })
      .catch(() => setError("Failed to load data sources"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAndScan();
  }, [fetchAndScan]);

  // Build unified list: managed first, then discovered
  const rows: DataSourceRow[] = [
    ...dbList.map((db): DataSourceRow => ({ kind: "managed", db })),
    ...discovered.map((source): DataSourceRow => ({ kind: "discovered", source })),
  ];

  const handleAdd = async () => {
    if (!dbName.trim()) return;
    if (provider === "manual" && !connectionString.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, string> = {
        name: dbName.trim(),
        type: dbType,
        provider,
      };
      if (provider === "manual") {
        body.connectionString = connectionString;
      }
      const res = await fetch("/api/databases", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add data source");
        return;
      }
      setDbList((prev) => [...prev, data.database]);
      setShowForm(false);
      setDbName("");
      setConnectionString("");
      toast.success("Data source added");
    } catch {
      setError("Failed to add data source");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setError(null);
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
        setError(data.error ?? "Failed to delete data source");
      }
    } catch {
      setError("Failed to delete data source");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Data Sources</h1>
          <Muted>
            Databases and connection strings for {currentOrg.name}.
          </Muted>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="size-3.5" />
            Add Data Source
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Add data source form */}
      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">New Data Source</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setProvider("manual")}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                    provider === "manual"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Manual
                </button>
                <button
                  type="button"
                  onClick={() => setProvider("neon")}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                    provider === "neon"
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
                <Select value={dbType} onValueChange={setDbType}>
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
              {provider === "manual" && (
                <Input
                  type="text"
                  value={connectionString}
                  onChange={(e) => setConnectionString(e.target.value)}
                  placeholder="Connection string (e.g. postgres://user:pass@host/db)"
                  className="font-mono text-[0.8125rem]"
                />
              )}
              {provider === "neon" && (
                <Muted>
                  A new Neon PostgreSQL project will be created automatically.
                  Requires NEON_API_KEY in team settings.
                </Muted>
              )}
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={
                saving ||
                !dbName.trim() ||
                (provider === "manual" && !connectionString.trim())
              }
              size="sm"
            >
              {saving
                ? provider === "neon"
                  ? "Provisioning..."
                  : "Saving..."
                : provider === "neon"
                  ? "Provision"
                  : "Add"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Unified data sources list */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Database className="size-8 text-muted-foreground/50" />
              <Muted>No data sources found.</Muted>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {rows.map((row, i) => {
                if (row.kind === "managed") {
                  const db = row.db;
                  return (
                    <Item key={db.id} variant="outline" size="sm">
                      <ItemMedia variant="icon">
                        <Database className="size-4" />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>{db.name}</ItemTitle>
                        <ItemDescription>
                          {db.provider === "neon" ? "Neon" : "Manual"} &middot;{" "}
                          {db.type}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Badge
                          className={
                            db.status === "ready"
                              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
                              : db.status === "error"
                                ? "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
                                : "border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300"
                          }
                        >
                          {db.status}
                        </Badge>
                        {isAdmin && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="xs"
                                className="text-destructive hover:text-destructive/80"
                                disabled={deletingId === db.id}
                              >
                                {deletingId === db.id ? "Deleting..." : "Delete"}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete data source
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Delete &ldquo;{db.name}&rdquo;? This is
                                  permanent
                                  {db.provider === "neon" &&
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
                                  onClick={() => handleDelete(db.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </CardFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </ItemActions>
                    </Item>
                  );
                }

                const s = row.source;
                return (
                  <Item key={`disc-${s.projectId}-${s.key}-${i}`} variant="outline" size="sm">
                    <ItemMedia variant="icon">
                      <Database className="size-4" />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="font-mono text-sm">{s.key}</ItemTitle>
                      <ItemDescription>
                        {s.projectName ?? "Organization"} &middot;{" "}
                        <span className="font-mono text-xs">{s.maskedValue}</span>
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Badge variant="outline">secret</Badge>
                    </ItemActions>
                  </Item>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
