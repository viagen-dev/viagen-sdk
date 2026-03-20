import { Bot, Zap } from "lucide-react";
import { SidebarToggle } from "~/components/sidebar-toggle";

export default function InboxPage() {
  return (
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center h-14 px-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          <SidebarToggle />
          <h1 className="text-base font-semibold">Inbox</h1>
        </div>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center h-full py-24 gap-6 select-none">
        {/* Illustration */}
        <div className="relative">
          {/* Spinning dashed ring */}
          <div
            className="absolute inset-0 rounded-full border border-dashed border-muted-foreground/20 animate-spin [animation-duration:10s]"
            style={{ margin: "-20px" }}
          />
          {/* Soft glow */}
          <div
            className="absolute inset-0 rounded-full bg-primary/10 blur-xl animate-pulse"
            style={{ margin: "-10px" }}
          />
          {/* Central icon tile */}
          <div className="relative flex items-center justify-center size-16 rounded-2xl bg-muted border border-border shadow-sm">
            <Bot className="size-8 text-muted-foreground" />
            {/* Zap badge */}
            <div className="absolute -top-2 -right-2 flex items-center justify-center size-5 rounded-full bg-primary text-primary-foreground shadow">
              <Zap className="size-3 fill-current" />
            </div>
          </div>
        </div>

        {/* Copy */}
        <div className="flex flex-col items-center gap-2 text-center max-w-xs">
          <p className="text-sm font-medium">We're working on this page…</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Inbox is coming soon. You'll be able to track notifications,
            mentions, and PR updates right here.
          </p>
        </div>
      </div>
    </div>
  );
}
