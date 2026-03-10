import { useState, useRef } from "react";
import { toast } from "sonner";
import { Loader2, Paperclip, X, FileText } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Muted } from "~/components/ui/typography";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

export interface Attachment {
  id: string;
  taskId: string;
  filename: string;
  blobUrl: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

const MAX_ATTACHMENTS = 3;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Compact attachment chip list with add/remove for ready tasks */
export function TaskAttachments({
  projectId,
  taskId,
  attachments,
  onChanged,
  readOnly = false,
}: {
  projectId: string;
  taskId: string;
  attachments: Attachment[];
  onChanged: (attachments: Attachment[]) => void;
  readOnly?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(
        `/api/projects/${projectId}/tasks/${taskId}/attachments`,
        { method: "POST", credentials: "include", body: form },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed");
        return;
      }
      onChanged([...attachments, data.attachment]);
      toast.success(`Attached ${file.name}`);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (att: Attachment) => {
    setDeletingId(att.id);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/tasks/${taskId}/attachments`,
        {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attachmentId: att.id }),
        },
      );
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to remove attachment");
        return;
      }
      onChanged(attachments.filter((a) => a.id !== att.id));
    } catch {
      toast.error("Failed to remove attachment");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {attachments.map((att) => (
        <span
          key={att.id}
          className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground"
        >
          <FileText className="size-3 shrink-0" />
          <a
            href={att.blobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline truncate max-w-[120px]"
            title={`${att.filename} (${formatSize(att.sizeBytes)})`}
          >
            {att.filename}
          </a>
          {!readOnly && (
            <button
              type="button"
              onClick={() => handleDelete(att)}
              disabled={deletingId === att.id}
              className="ml-0.5 rounded-sm hover:bg-muted p-0.5 disabled:opacity-50"
            >
              {deletingId === att.id ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <X className="size-3" />
              )}
            </button>
          )}
        </span>
      ))}
      {!readOnly && attachments.length < MAX_ATTACHMENTS && (
        <>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-6"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Paperclip className="size-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Attach file ({attachments.length}/{MAX_ATTACHMENTS})
            </TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );
}

/** Minimal version for the task launcher (before task exists — stages files locally) */
export function StagedAttachments({
  files,
  onFilesChanged,
}: {
  files: File[];
  onFilesChanged: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {files.map((file, i) => (
        <span
          key={`${file.name}-${i}`}
          className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground"
        >
          <FileText className="size-3 shrink-0" />
          <span className="truncate max-w-[120px]" title={`${file.name} (${formatSize(file.size)})`}>
            {file.name}
          </span>
          <button
            type="button"
            onClick={() => onFilesChanged(files.filter((_, j) => j !== i))}
            className="ml-0.5 rounded-sm hover:bg-muted p-0.5"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {files.length < MAX_ATTACHMENTS && (
        <>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onFilesChanged([...files, file]);
                if (inputRef.current) inputRef.current.value = "";
              }
            }}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-6"
                onClick={() => inputRef.current?.click()}
              >
                <Paperclip className="size-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Attach file ({files.length}/{MAX_ATTACHMENTS})
            </TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );
}
