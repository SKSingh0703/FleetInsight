import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div />;

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
  const { user, loading } = useAuth();

  if (loading) return <div />;

  if (!user) return <Navigate to="/login" replace />;
  if (user.status !== "APPROVED") return <Navigate to="/pending" replace />;
  if (user.role !== "ADMIN") return <Navigate to="/" replace />;

  return children;
}
