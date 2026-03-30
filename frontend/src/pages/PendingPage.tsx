import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthContext";
import { useNavigate } from "react-router-dom";

export default function PendingPage() {
  const { user, logout, refresh } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
      <div className="w-full max-w-lg rounded-xl border bg-card p-6 space-y-4">
        <div>
          <h1 className="text-xl font-display font-bold">Access Pending</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your access request is under review. Please contact an admin to approve your account.
          </p>
        </div>

        <div className="text-sm">
          <p>
            <span className="text-muted-foreground">Signed in as:</span> {user?.email || ""}
          </p>
          <p>
            <span className="text-muted-foreground">Status:</span> {user?.status || ""}
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void refresh()}>
            Check approval status
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
          >
            Sign out
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          If an admin approves you, click “Check approval status” to enter the app.
        </p>
      </div>
    </div>
  );
}
