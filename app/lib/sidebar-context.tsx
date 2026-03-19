import { createContext, useContext } from "react";

interface SidebarContextValue {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  sidebarOpen: true,
  toggleSidebar: () => {},
});

export function SidebarProvider({
  value,
  children,
}: {
  value: SidebarContextValue;
  children: React.ReactNode;
}) {
  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
