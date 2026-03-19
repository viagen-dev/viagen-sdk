import { useState, useRef, useEffect } from "react";
import { Link } from "react-router";
import {
  Box,
  GitBranch,
  Loader2,
  Paperclip,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";

import type { FeedTask, Project } from "~/types/task";
import { Dialog, DialogContent, DialogClose } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  integrations?: { github: boolean; vercel: boolean; claude: boolean };
  defaultProjectId?: string | null;
  onTaskCreated: (task: FeedTask) => void;
}

const generateRandomBranch = () =>
  `feat-${Math.random().toString(36).slice(2, 8)}`;

const MODELS = [
  { value: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { value: "claude-opus-4-6", label: "Opus 4.6" },
  { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
];

export function CreateTaskModal({
  open,
  onOpenChange,
  projects,
  integrations,
  defaultProjectId,
  onTaskCreated,
}: CreateTaskModalProps) {
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? "");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [branch, setBranch] = useState(() => generateRandomBranch());
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [creating, setCreating] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);

  const titleRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync defaultProjectId when it changes externally
  useEffect(() => {
    if (defaultProjectId) setProjectId(defaultProjectId);
  }, [defaultProjectId]);

  // Reset form and focus title on open
  useEffect(() => {
    if (open) {
      setTitle("");
      setPrompt("");
      setBranch(generateRandomBranch());
      setModel("claude-sonnet-4-6");
      setStagedFiles([]);
      setProjectId(defaultProjectId ?? "");
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [open, defaultProjectId]);

  const selectedProject = projectId
    ? (projects.find((p) => p.id === projectId) ?? null)
    : null;

  const needsClaude = !integrations?.claude;

  const canSubmit =
    selectedProject !== null &&
    !needsClaude &&
    !creating &&
    prompt.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedProject) return;
    setCreating(true);

    try {
      const res = await fetch(`/api/projects/${selectedProject.id}/tasks`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || null,
          prompt: prompt.trim(),
          branch: branch.trim(),
          model,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Failed to create task");
        return;
      }

      const task = data.task as FeedTask;
      if (!task.projectName) {
        task.projectId = selectedProject.id;
        task.projectName = selectedProject.name;
        task.githubRepo = selectedProject.githubRepo;
        task.vercelProjectId = selectedProject.vercelProjectId;
        task.vercelProjectName = selectedProject.vercelProjectName;
      }

      // Upload staged attachments (fire-and-forget)
      for (const file of stagedFiles) {
        const form = new FormData();
        form.append("file", file);
        fetch(
          `/api/projects/${selectedProject.id}/tasks/${task.id}/attachments`,
          { method: "POST", credentials: "include", body: form },
        ).catch(() => {});
      }

      onTaskCreated(task);
      toast.success("Task created");
      onOpenChange(false);
    } catch {
      toast.error("Failed to create task");
    } finally {
      setCreating(false);
    }
  };

  const selectedModel = MODELS.find((m) => m.value === model) ?? MODELS[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 sm:max-w-2xl overflow-hidden"
        showCloseButton={false}
      >
        <div className="flex flex-col min-h-64">
          {/* ── Top row: project pill + close ── */}
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger
                className={cn(
                  "h-8 w-auto gap-2 border rounded-lg px-3 text-sm font-medium shadow-none focus:ring-0",
                  "hover:bg-accent transition-colors",
                  !selectedProject && "text-muted-foreground",
                )}
              >
                <Box className="size-4 shrink-0" />
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DialogClose className="rounded-sm opacity-70 hover:opacity-100 transition-opacity focus:outline-none">
              <X className="size-5" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>

          {/* ── Claude key warning ── */}
          {needsClaude && (
            <div className="px-5 pb-1">
              <p className="text-xs text-muted-foreground">
                Connect your{" "}
                <Link
                  to="/settings?tab=settings"
                  className="underline font-medium"
                >
                  Claude API key
                </Link>{" "}
                to get started.
              </p>
            </div>
          )}

          {/* ── Title ── */}
          <div className="px-5 pt-3">
            <Input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  promptRef.current?.focus();
                }
              }}
              placeholder="Task title"
              disabled={creating}
              className="w-full border-0 bg-transparent shadow-none px-0 text-2xl font-semibold placeholder:text-muted-foreground/40 placeholder:font-semibold focus-visible:ring-0 h-auto"
            />
          </div>

          {/* ── Prompt ── */}
          <div className="px-5 pt-2 flex-1">
            <Textarea
              ref={promptRef}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={
                needsClaude
                  ? "Connect your Claude API key first…"
                  : !selectedProject
                    ? "Select a project first…"
                    : "Add prompt"
              }
              disabled={!selectedProject || needsClaude || creating}
              rows={3}
              className="border-0 bg-transparent shadow-none px-0 text-base placeholder:text-muted-foreground/40 focus-visible:ring-0 resize-none overflow-hidden min-h-0"
            />
          </div>

          {/* ── Staged attachments ── */}
          {stagedFiles.length > 0 && (
            <div className="px-5 pb-2 flex flex-wrap gap-1.5">
              {stagedFiles.map((file, i) => (
                <span
                  key={`${file.name}-${i}`}
                  className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground"
                >
                  <Paperclip className="size-3 shrink-0" />
                  <span className="truncate max-w-[140px]">{file.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setStagedFiles(stagedFiles.filter((_, j) => j !== i))
                    }
                    className="ml-0.5 rounded-sm hover:bg-muted p-0.5"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* ── Bottom toolbar ── */}
          <div className="flex items-center justify-between px-5 pb-5 pt-4 border-t mt-4">
            {/* Left: attribute pills */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Assignee — display only for now */}
              <div className="inline-flex items-center gap-1.5 rounded-lg border px-3 h-8 text-sm text-muted-foreground bg-background">
                <User className="size-3.5 shrink-0" />
                <span>Me</span>
              </div>

              {/* Branch */}
              <div className="inline-flex items-center gap-1.5 rounded-lg border px-2 h-8 text-sm bg-background">
                <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
                <Input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="border-0 bg-transparent shadow-none px-0 text-sm text-muted-foreground focus-visible:ring-0 h-auto w-28"
                />
              </div>

              {/* Model */}
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="h-8 w-auto gap-1.5 border rounded-lg px-3 text-sm text-muted-foreground shadow-none focus:ring-0 hover:bg-accent transition-colors">
                  <Sparkles className="size-3.5 shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Right: attach + submit */}
            <div className="flex items-center gap-2">
              {/* File attachment */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && stagedFiles.length < 3) {
                    setStagedFiles([...stagedFiles, file]);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 rounded-lg shadow-none"
                disabled={stagedFiles.length >= 3 || creating}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="size-4" />
              </Button>

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="rounded-lg px-5 h-9 text-sm font-semibold"
              >
                {creating ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Creating…
                  </>
                ) : (
                  "Create task"
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
