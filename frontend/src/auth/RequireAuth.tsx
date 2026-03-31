import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading, online, authError, refresh } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 rounded-lg border bg-background p-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium">Loading session…</div>
              <div className="text-sm text-muted-foreground">Verifying your login and preparing your dashboard.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user && (!online || authError === "NETWORK")) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-full max-w-md space-y-3">
          <Alert variant="destructive">
            <AlertTitle>You're offline</AlertTitle>
            <AlertDescription>
              We can't reach the server right now. Check your internet or backend server, then try again.
            </AlertDescription>
          </Alert>
          <Button variant="secondary" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (user.status === "PENDING") {
    return <Navigate to="/pending" replace />;
  }

  if (user.status !== "APPROVED") {
    return <Navigate to="/pending" replace />;
  }

  return children;
}

export function RequireAdmin({ children }: { children: JSX.Element }) {
  const { user, loading, online, authError, refresh } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 rounded-lg border bg-background p-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium">Loading session…</div>
              <div className="text-sm text-muted-foreground">Verifying your login and preparing the admin panel.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user && (!online || authError === "NETWORK")) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-full max-w-md space-y-3">
          <Alert variant="destructive">
            <AlertTitle>You're offline</AlertTitle>
            <AlertDescription>
              We can't reach the server right now. Check your internet or backend server, then try again.
            </AlertDescription>
          </Alert>
          <Button variant="secondary" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.status !== "APPROVED") return <Navigate to="/pending" replace />;
  if (user.role !== "ADMIN") return <Navigate to="/access-denied" replace />;

  return children;
}
