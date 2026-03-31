import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GoogleOAuthProvider } from "@react-oauth/google";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import SearchPage from "@/pages/SearchPage";
import UploadPage from "@/pages/UploadPage";
import LoginPage from "@/pages/LoginPage";
import PendingPage from "@/pages/PendingPage";
import AdminPage from "@/pages/AdminPage";
import AccessDenied from "@/pages/AccessDenied";
import NotFound from "@/pages/NotFound";
import { AuthProvider } from "@/auth/AuthContext";
import { RequireAdmin, RequireAuth } from "@/auth/RequireAuth";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ""}>
        <BrowserRouter>
          <AuthProvider>
            <AppLayout>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/pending" element={<PendingPage />} />
                <Route
                  path="/access-denied"
                  element={
                    <RequireAuth>
                      <AccessDenied />
                    </RequireAuth>
                  }
                />

                <Route
                  path="/"
                  element={
                    <RequireAuth>
                      <Dashboard />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/search"
                  element={
                    <RequireAuth>
                      <SearchPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/upload"
                  element={
                    <RequireAuth>
                      <UploadPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <RequireAdmin>
                      <AdminPage />
                    </RequireAdmin>
                  }
                />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          </AuthProvider>
        </BrowserRouter>
      </GoogleOAuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
