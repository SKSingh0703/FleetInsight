import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useState } from "react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-card/80 backdrop-blur-md px-4 md:px-6">
            <SidebarTrigger className="shrink-0" />
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
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
