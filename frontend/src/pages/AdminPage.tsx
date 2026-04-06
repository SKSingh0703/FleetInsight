import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminApproveUser,
  adminGetSheetSyncStatus,
  adminListUsers,
  adminMakeAdmin,
  adminRejectUser,
  adminRemoveUser,
  adminRunSheetSyncNow,
  adminSuggestSheetSyncTabs,
  adminUpsertSheetSyncConfig,
  ApiError,
} from "@/services/api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { useEffect, useMemo, useState } from "react";

export default function AdminPage() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const [removeTarget, setRemoveTarget] = useState<{ id: string; email: string } | null>(null);

  function getApiErrorMessage(err: unknown): string {
    if (!err) return "Request failed";
    if (err instanceof ApiError) {
      const raw = typeof err.bodyText === "string" && err.bodyText.trim() ? err.bodyText : err.message;
      try {
        const parsed = JSON.parse(raw) as { message?: unknown };
        if (typeof parsed?.message === "string" && parsed.message.trim()) return parsed.message.trim();
      } catch {
        // ignore
      }
      return raw || "Request failed";
    }
    if (err instanceof Error) return err.message;
    return "Request failed";
  }

  function isSyncAlreadyRunningMessage(msg: string) {
    const m = (msg || "").toLowerCase();
    return m.includes("already running") || m.includes("sync already running");
  }

  const [sheetEnabled, setSheetEnabled] = useState(true);
  const [sheetSpreadsheetId, setSheetSpreadsheetId] = useState("");
  const [sheetAutoDiscover, setSheetAutoDiscover] = useState(true);
  const [sheetIntervalSeconds, setSheetIntervalSeconds] = useState(120);
  const [sheetDefaultRange, setSheetDefaultRange] = useState("A:AZ");
  const [sheetDefaultHeaderRow, setSheetDefaultHeaderRow] = useState(1);
  const [manualTabCurrent, setManualTabCurrent] = useState("");
  const [manualTabPrevious, setManualTabPrevious] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["adminUsers"],
    queryFn: adminListUsers,
    placeholderData: (prev) => prev,
    retry: 2,
    retryDelay: 800,
  });

  const sheetStatus = useQuery({
    queryKey: ["sheetSyncStatus"],
    queryFn: adminGetSheetSyncStatus,
    placeholderData: (prev) => prev,
    retry: 2,
    retryDelay: 800,
  });

  const suggestionsEnabled = sheetAutoDiscover && sheetSpreadsheetId.trim().length > 0;
  const sheetSuggestions = useQuery({
    queryKey: ["sheetSyncSuggest", sheetSpreadsheetId],
    queryFn: () => adminSuggestSheetSyncTabs(sheetSpreadsheetId.trim()),
    enabled: suggestionsEnabled,
    placeholderData: (prev) => prev,
    retry: 1,
    retryDelay: 800,
  });

  const approve = useMutation({
    mutationFn: (userId: string) => adminApproveUser(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adminUsers"] }),
  });

  const reject = useMutation({
    mutationFn: (userId: string) => adminRejectUser(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adminUsers"] }),
  });

  const makeAdmin = useMutation({
    mutationFn: (userId: string) => adminMakeAdmin(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adminUsers"] }),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => adminRemoveUser(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adminUsers"] }),
  });

  const saveSheetConfig = useMutation({
    mutationFn: () =>
      adminUpsertSheetSyncConfig({
        enabled: sheetEnabled,
        spreadsheetId: sheetSpreadsheetId.trim(),
        autoDiscoverTabs: sheetAutoDiscover,
        syncIntervalSeconds: sheetIntervalSeconds,
        defaultRange: sheetDefaultRange.trim() || "A:AZ",
        defaultHeaderRow: sheetDefaultHeaderRow,
        tabs: sheetAutoDiscover
          ? []
          : [manualTabCurrent, manualTabPrevious]
              .map((t) => t.trim())
              .filter(Boolean)
              .map((tabName) => ({ tabName, range: sheetDefaultRange.trim() || "A:AZ", headerRow: sheetDefaultHeaderRow })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sheetSyncStatus"] });
      qc.invalidateQueries({ queryKey: ["sheetSyncSuggest"] });
      toast({
        title: "Configuration saved",
        description: "Sheet sync settings have been updated.",
      });
    },
    onError: (err) => {
      toast({
        title: "Unable to save configuration",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    },
  });

  const runSheetSync = useMutation({
    mutationFn: adminRunSheetSyncNow,
    onSuccess: () => {
      toast({
        title: "Sync started",
        description: "Google Sheet sync is running. Refresh status in a moment.",
      });
    },
    onError: (err) => {
      const msg = getApiErrorMessage(err);
      if (isSyncAlreadyRunningMessage(msg)) {
        toast({
          title: "Sync already running",
          description: "A sync is currently in progress. Please wait and refresh status.",
        });
        return;
      }
      toast({
        title: "Unable to start sync",
        description: msg,
        variant: "destructive",
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["sheetSyncStatus"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  useEffect(() => {
    const integration = sheetStatus.data?.integration;
    if (!integration) return;
    setSheetEnabled(Boolean(integration.enabled));
    setSheetSpreadsheetId(integration.spreadsheetId || "");
    setSheetAutoDiscover(integration.autoDiscoverTabs ?? true);
    setSheetIntervalSeconds(Number(integration.syncIntervalSeconds ?? 120));
    setSheetDefaultRange(integration.defaultRange || "A:AZ");
    setSheetDefaultHeaderRow(Number(integration.defaultHeaderRow ?? 1));

    const tabs = Array.isArray(integration.tabs) ? integration.tabs : [];
    setManualTabCurrent(tabs[0]?.tabName || "");
    setManualTabPrevious(tabs[1]?.tabName || "");
  }, [sheetStatus.data?.integration]);

  const users = data?.users || [];
  const currentUserId = currentUser?.id || "";

  const resolvedTabsLabel = useMemo(() => {
    if (!sheetAutoDiscover) {
      const manual = [manualTabCurrent, manualTabPrevious].map((t) => t.trim()).filter(Boolean);
      return manual.length > 0 ? manual.join(" • ") : "No tabs configured";
    }
    const s = sheetSuggestions.data?.suggested;
    const cur = s?.current || "";
    const prev = s?.previous || "";
    const list = [cur, prev].filter(Boolean);
    return list.length > 0 ? list.join(" • ") : "No tabs suggested";
  }, [manualTabCurrent, manualTabPrevious, sheetAutoDiscover, sheetSuggestions.data?.suggested]);

  const anyNetworkError =
    (error instanceof ApiError && error.isNetworkError) ||
    (sheetStatus.error instanceof ApiError && sheetStatus.error.isNetworkError);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Admin Panel</h1>
        <p className="text-sm text-muted-foreground mt-1">Approve users and manage access.</p>
      </div>

      {(error || sheetStatus.error) && (
        <Alert variant="destructive">
          <AlertTitle>{anyNetworkError ? "Server unreachable" : "Something went wrong"}</AlertTitle>
          <AlertDescription>
            <div className="space-y-2">
              <div>
                {anyNetworkError
                  ? "Unable to reach the backend. Check your connection or restart the backend server."
                  : error instanceof Error
                    ? error.message
                    : sheetStatus.error instanceof Error
                      ? sheetStatus.error.message
                      : "Request failed"}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  qc.invalidateQueries({ queryKey: ["adminUsers"] });
                  qc.invalidateQueries({ queryKey: ["sheetSyncStatus"] });
                  qc.invalidateQueries({ queryKey: ["sheetSyncSuggest"] });
                }}
              >
                Retry
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="sheets">Sheets Sync</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          {isLoading && <div className="text-sm text-muted-foreground">Loading users…</div>}
          {error && (
            <div className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed"}
            </div>
          )}
          {remove.error && (
            <div className="text-sm text-destructive">
              {remove.error instanceof Error ? remove.error.message : "Failed to remove user"}
            </div>
          )}

          {!isLoading && !error && (
            <div className="rounded-xl border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3">Name</th>
                    <th className="text-left p-3">Email</th>
                    <th className="text-left p-3">Role</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t">
                      <td className="p-3">{u.name || ""}</td>
                      <td className="p-3">{u.email}</td>
                      <td className="p-3">{u.role}</td>
                      <td className="p-3">{u.status}</td>
                      <td className="p-3">
                        {u.id === currentUserId ? (
                          <span className="text-xs text-muted-foreground">You</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {u.status === "PENDING" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={approve.isPending}
                                  onClick={() => approve.mutate(u.id)}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={reject.isPending}
                                  onClick={() => reject.mutate(u.id)}
                                >
                                  Reject
                                </Button>
                              </>
                            )}

                            {u.status === "APPROVED" && u.role !== "ADMIN" && (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={makeAdmin.isPending}
                                onClick={() => makeAdmin.mutate(u.id)}
                              >
                                Make Admin
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={remove.isPending}
                              onClick={() => {
                                setRemoveTarget({ id: u.id, email: u.email });
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-muted-foreground">
                        No users.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="sheets">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Google Sheets Auto-Sync</CardTitle>
                <CardDescription>
                  Auto-sync trips from Google Sheets. Default mode automatically selects the current + previous month tabs.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sheetStatus.isLoading && <div className="text-sm text-muted-foreground">Loading sync status…</div>}
                {sheetStatus.error && (
                  <div className="text-sm text-destructive">
                    {sheetStatus.error instanceof Error ? sheetStatus.error.message : "Failed"}
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sheetId">Spreadsheet ID</Label>
                    <Input
                      id="sheetId"
                      value={sheetSpreadsheetId}
                      onChange={(e) => setSheetSpreadsheetId(e.target.value)}
                      placeholder="Paste Spreadsheet ID"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="interval">Sync Interval (seconds)</Label>
                    <Input
                      id="interval"
                      type="number"
                      min={30}
                      value={sheetIntervalSeconds}
                      onChange={(e) => setSheetIntervalSeconds(Number(e.target.value || 0))}
                    />
                    <div className="text-xs text-muted-foreground">Minimum 30 seconds. Recommended 60–180 seconds.</div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <div className="text-sm font-medium">Enabled</div>
                      <div className="text-xs text-muted-foreground">Turn on/off background sync.</div>
                    </div>
                    <Switch checked={sheetEnabled} onCheckedChange={setSheetEnabled} />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <div className="text-sm font-medium">Auto-detect tabs</div>
                      <div className="text-xs text-muted-foreground">Current + previous month tabs are picked automatically.</div>
                    </div>
                    <Switch checked={sheetAutoDiscover} onCheckedChange={setSheetAutoDiscover} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="range">Default Range</Label>
                    <Input
                      id="range"
                      value={sheetDefaultRange}
                      onChange={(e) => setSheetDefaultRange(e.target.value)}
                      placeholder="A:AZ"
                    />
                    <div className="text-xs text-muted-foreground">Wide default range to support future columns.</div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="headerRow">Header Row</Label>
                    <Input
                      id="headerRow"
                      type="number"
                      min={1}
                      value={sheetDefaultHeaderRow}
                      onChange={(e) => setSheetDefaultHeaderRow(Number(e.target.value || 1))}
                    />
                  </div>
                </div>

                {!sheetAutoDiscover && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="tabCur">Manual Tab (Current month)</Label>
                      <Input id="tabCur" value={manualTabCurrent} onChange={(e) => setManualTabCurrent(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tabPrev">Manual Tab (Previous month)</Label>
                      <Input id="tabPrev" value={manualTabPrevious} onChange={(e) => setManualTabPrevious(e.target.value)} />
                    </div>
                  </div>
                )}

                {sheetAutoDiscover && sheetSpreadsheetId.trim().length > 0 && (
                  <div className="rounded-lg border p-3 space-y-1">
                    <div className="text-sm font-medium">Suggested tabs</div>
                    {sheetSuggestions.isLoading ? (
                      <div className="text-sm text-muted-foreground">Detecting tabs…</div>
                    ) : sheetSuggestions.error ? (
                      <div className="text-sm text-destructive">
                        {sheetSuggestions.error instanceof Error ? sheetSuggestions.error.message : "Failed"}
                      </div>
                    ) : (
                      <div className="text-sm">{resolvedTabsLabel}</div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={saveSheetConfig.isPending || sheetSpreadsheetId.trim().length === 0}
                    onClick={() => saveSheetConfig.mutate()}
                  >
                    {saveSheetConfig.isPending ? "Saving…" : "Save configuration"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={runSheetSync.isPending}
                    onClick={() => runSheetSync.mutate()}
                  >
                    {runSheetSync.isPending ? "Syncing…" : "Sync now"}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={sheetStatus.isFetching}
                    onClick={() => {
                      qc.invalidateQueries({ queryKey: ["sheetSyncStatus"] });
                      toast({
                        title: "Refreshing status",
                        description: "Fetching latest sync status from the server.",
                      });
                    }}
                  >
                    Refresh status
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="justify-between">
                <div className="text-xs text-muted-foreground">
                  Resolved tabs: <span className="font-medium text-foreground">{resolvedTabsLabel}</span>
                </div>
              </CardFooter>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tab status</CardTitle>
                  <CardDescription>Last run stats saved per tab.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tab</TableHead>
                        <TableHead>Last run</TableHead>
                        <TableHead className="text-right">Changed</TableHead>
                        <TableHead className="text-right">Upserted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(sheetStatus.data?.states || []).map((s) => (
                        <TableRow key={s.tabName}>
                          <TableCell className="font-medium">{s.tabName}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {s.lastRunAt ? new Date(s.lastRunAt).toLocaleString() : "—"}
                          </TableCell>
                          <TableCell className="text-right">{s.lastStats?.changed ?? 0}</TableCell>
                          <TableCell className="text-right">{s.lastStats?.upsertUpserted ?? 0}</TableCell>
                        </TableRow>
                      ))}
                      {(sheetStatus.data?.states || []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            No tab runs yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent runs</CardTitle>
                  <CardDescription>Latest sync attempts (including 0-change runs).</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(sheetStatus.data?.runs || []).slice(0, 10).map((r) => {
                      const when = r.startedAt ? new Date(r.startedAt).toLocaleString() : "";
                      const totalChanged = (r.results || []).reduce((sum, x) => sum + (x.changed || 0), 0);
                      return (
                        <div key={r._id || `${r.startedAt}`} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-medium">{r.status}</div>
                            <div className="text-xs text-muted-foreground">{when}</div>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Changed rows: <span className="text-foreground font-medium">{totalChanged}</span>
                            {r.message ? <span className="text-destructive"> — {r.message}</span> : null}
                          </div>
                        </div>
                      );
                    })}
                    {(sheetStatus.data?.runs || []).length === 0 && (
                      <div className="text-sm text-muted-foreground">No runs recorded yet.</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => (!open ? setRemoveTarget(null) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove user?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove user {removeTarget?.email || ""}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending} onClick={() => setRemoveTarget(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={() => {
                if (!removeTarget) return;
                remove.mutate(removeTarget.id, {
                  onSettled: () => setRemoveTarget(null),
                });
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
