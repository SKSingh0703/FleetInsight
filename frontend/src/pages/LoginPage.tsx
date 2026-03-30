import { GoogleLogin } from "@react-oauth/google";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { postAuthGoogle } from "@/services/api";
import { useAuth } from "@/auth/AuthContext";
import { ShieldCheck, Truck, Search, Upload } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const hasGoogleClientId = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

  const mutation = useMutation({
    mutationFn: async (credential: string) => postAuthGoogle(credential),
    onSuccess: (res) => {
      setSession(res.token, res.user);
      if (res.user.status === "PENDING") {
        navigate("/pending", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40 flex items-center">
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              Secure access controlled by admin approval
            </div>

            <div>
              <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">FleetInsight</h1>
              <p className="text-sm md:text-base text-muted-foreground mt-2 max-w-prose">
                Trip uploads, search, and dashboards for your fleet—protected with Google Sign-In and role-based access.
              </p>
            </div>

            <div className="grid gap-3 text-sm">
              <div className="flex items-start gap-3">
                <Truck className="h-4 w-4 mt-0.5 text-primary" />
                <div>
                  <div className="font-medium">Fleet-level visibility</div>
                  <div className="text-muted-foreground">View trips, party details, freight and shortage.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Upload className="h-4 w-4 mt-0.5 text-primary" />
                <div>
                  <div className="font-medium">Excel import</div>
                  <div className="text-muted-foreground">Upload .xlsx sheets and preserve raw data.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Search className="h-4 w-4 mt-0.5 text-primary" />
                <div>
                  <div className="font-medium">Fast search</div>
                  <div className="text-muted-foreground">Filter by vehicle, invoice, party, and dates.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="md:justify-self-end w-full max-w-md">
            <div className="rounded-2xl border bg-card/80 backdrop-blur p-6 shadow-sm">
              <div className="space-y-1">
                <h2 className="text-lg font-display font-bold">Sign in</h2>
                <p className="text-sm text-muted-foreground">Use your Google account to continue.</p>
              </div>

              <div className="mt-5 space-y-3">
                {!hasGoogleClientId ? (
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                    <div className="font-medium">Google login is not configured</div>
                    <div className="text-muted-foreground mt-1">
                      Set <code className="px-1 py-0.5 rounded bg-muted">VITE_GOOGLE_CLIENT_ID</code> in
                      <code className="px-1 py-0.5 rounded bg-muted ml-1">frontend/.env</code>.
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <GoogleLogin
                      onSuccess={(credentialResponse) => {
                        const credential = credentialResponse.credential;
                        if (credential) mutation.mutate(credential);
                      }}
                      onError={() => {
                        // handled below
                      }}
                    />
                  </div>
                )}

                {mutation.isPending && <p className="text-sm text-muted-foreground">Signing you in…</p>}

                {mutation.isError && (
                  <p className="text-sm text-destructive">
                    {mutation.error instanceof Error ? mutation.error.message : "Login failed"}
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  New users are set to <span className="font-medium">PENDING</span> until approved by an admin.
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs text-muted-foreground text-center">
              By continuing, you agree to access company data responsibly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
