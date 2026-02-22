import { useState, useEffect, useRef } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent } from "~/components/ui/card";
import { Loader2, Send, GitBranch } from "lucide-react";

interface Workspace {
  id: string;
  sandboxId: string;
  url: string;
  expiresAt: string;
  branch: string;
  createdAt: string;
}

export function WorkspaceLauncher({
  projectId,
  allReady,
  onCreated,
  onError,
}: {
  projectId: string;
  allReady: boolean;
  onCreated: (workspace: Workspace) => void;
  onError: (message: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [branch, setBranch] = useState("feat");
  const [launching, setLaunching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (launching) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [launching]);

  const handleLaunch = async () => {
    if (launching) return;
    setLaunching(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/sandbox`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch,
          prompt: prompt.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error ?? "Failed to launch sandbox");
        return;
      }
      onCreated(data.workspace);
      setPrompt("");
    } catch {
      onError("Failed to launch sandbox");
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Card className="mb-6 border-0 shadow-none">
      <CardContent className="flex flex-col gap-3">
        <textarea
          placeholder="Describe a task for Claude to work on..."
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleLaunch();
            }
          }}
          rows={1}
          className="w-full resize-none overflow-hidden rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <GitBranch className="size-3.5 text-muted-foreground" />
            <Input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="feat"
              className="h-8 w-32 text-xs"
            />
          </div>
          <div className="flex-1" />
          <Button
            size="sm"
            disabled={!allReady || launching}
            onClick={handleLaunch}
          >
            {launching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {launching ? `Creating... ${elapsed}s` : "Run task"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
