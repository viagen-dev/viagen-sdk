import { useSidebar } from "~/lib/sidebar-context";
import { Button } from "~/components/ui/button";

function PanelLeftFilled({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Outer border */}
      <rect x="2" y="3" width="20" height="18" rx="2" />
      {/* Left panel — filled */}
      <rect x="2" y="3" width="7" height="18" rx="2" fill="currentColor" stroke="none" />
      {/* Vertical divider line */}
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

function PanelLeftOutline({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Outer border */}
      <rect x="2" y="3" width="20" height="18" rx="2" />
      {/* Vertical divider line */}
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

export function SidebarToggle({ className }: { className?: string }) {
  const { sidebarOpen, toggleSidebar } = useSidebar();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggleSidebar}
      className={className}
    >
      {sidebarOpen ? (
        <PanelLeftFilled className="size-4" />
      ) : (
        <PanelLeftOutline className="size-4" />
      )}
    </Button>
  );
}
