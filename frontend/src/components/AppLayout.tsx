import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useLocation, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { user, online, authError, refresh } = useAuth();
  const hideGlobalSearch = location.pathname === "/search";
  const isAuthScreen = location.pathname === "/login" || location.pathname === "/pending";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  if (isAuthScreen) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-card/80 backdrop-blur-md px-4 md:px-6">
            <SidebarTrigger className="shrink-0" />
            {!hideGlobalSearch ? (
              <form onSubmit={handleSearch} className="search-bar-global flex-1 max-w-xl">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search vehicle, invoice, chassis, book number..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                {query && (
                  <kbd className="hidden sm:inline-flex h-5 items-center rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                    Enter
                  </kbd>
                )}
              </form>
            ) : (
              <div className="flex-1" />
            )}
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            {!!user && (!online || authError === "NETWORK") && (
              <div className="mb-4">
                <Alert variant="destructive">
                  <AlertTitle>You're offline</AlertTitle>
                  <AlertDescription>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>Some features may not work until the connection is restored.</div>
                      <Button variant="secondary" size="sm" onClick={() => void refresh()}>
                        Retry
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            )}
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
