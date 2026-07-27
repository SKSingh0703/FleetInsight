import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminApproveUser,
  adminGetDriveSyncStatus,
  adminGetSheetSyncStatus,
  adminListUsers,
  adminMakeAdmin,
  adminRejectUser,
  adminRemoveUser,
  adminRunDriveSyncNow,
  adminAddDriveSyncRoot,
  adminDeleteDriveSyncRoot,
  adminRunSheetSyncNow,
  adminSuggestSheetSyncTabs,
  adminUpsertSheetSyncConfig,
  getAnnexureRecords,
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
import { Badge } from "@/components/ui/badge";
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
  const [annexureSearch, setAnnexureSearch] = useState("");
  const [annexurePage, setAnnexurePage] = useState(1);
  const [selectedRawRecord, setSelectedRawRecord] = useState<any | null>(null);

  const [newRootUrl, setNewRootUrl] = useState("");
  const [newRootName, setNewRootName] = useState("");
  const [newRootFy, setNewRootFy] = useState("");

  const addRootMutation = useMutation({
    mutationFn: adminAddDriveSyncRoot,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["driveSyncStatus"] });
      setNewRootUrl("");
      setNewRootName("");
      setNewRootFy("");
      toast({
        title: "Root Drive Folder Added",
        description: data.message,
      });
    },
    onError: (err) => {
      toast({
        title: "Failed to add Drive Folder",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    },
  });

  const deleteRootMutation = useMutation({
    mutationFn: adminDeleteDriveSyncRoot,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["driveSyncStatus"] });
      toast({
        title: "Root Folder Removed",
        description: data.message,
      });
    },
  });

  const driveStatus = useQuery({
    queryKey: ["driveSyncStatus"],
    queryFn: adminGetDriveSyncStatus,
    placeholderData: (prev) => prev,
    retry: 1,
    retryDelay: 800,
  });

  const annexuresQuery = useQuery({
    queryKey: ["annexures", annexurePage, annexureSearch],
    queryFn: ({ signal }) =>
      getAnnexureRecords({ page: annexurePage, limit: 50, search: annexureSearch, signal }),
    placeholderData: (prev) => prev,
    retry: 1,
    retryDelay: 800,
  });

  const runDriveSync = useMutation({
    mutationFn: adminRunDriveSyncNow,
    onSuccess: () => {
      toast({
        title: "Drive scan & extraction completed",
        description: "Google Drive bill folders scanned and annexures extracted.",
      });
    },
    onError: (err) => {
      toast({
        title: "Drive sync issue",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["driveSyncStatus"] });
      qc.invalidateQueries({ queryKey: ["annexures"] });
    },
  });

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
          <TabsTrigger value="drive">Drive Bills & Annexures</TabsTrigger>
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

        <TabsContent value="drive">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">Google Drive Bill Folder Scanner</CardTitle>
                    <CardDescription>
                      Recursively scans all connected Google Drive root folders, detects Bill Folders, and extracts Annexure sheets into structured database records.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      disabled={runDriveSync.isPending}
                      onClick={() => runDriveSync.mutate()}
                    >
                      {runDriveSync.isPending ? "Scanning & Extracting…" : "Scan All Connected Drives Now"}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={driveStatus.isFetching}
                      onClick={() => {
                        qc.invalidateQueries({ queryKey: ["driveSyncStatus"] });
                        qc.invalidateQueries({ queryKey: ["annexures"] });
                      }}
                    >
                      Refresh Status
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {driveStatus.error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertTitle>Drive Scanner Notice</AlertTitle>
                    <AlertDescription>
                      <div className="space-y-2">
                        <div>
                          {getApiErrorMessage(driveStatus.error)}
                        </div>
                        {getApiErrorMessage(driveStatus.error).includes("Google Drive API is disabled") && (
                          <div className="text-xs mt-2 bg-destructive/10 p-3 rounded border border-destructive/20 space-y-1">
                            <p className="font-semibold">Action Required:</p>
                            <p>Enable the Google Drive API for your Google Cloud project (ID: 242773855902) using this direct link:</p>
                            <a
                              href="https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=242773855902"
                              target="_blank"
                              rel="noreferrer"
                              className="underline font-mono text-xs font-bold hover:text-white"
                            >
                              Enable Google Drive API in GCP Console ↗
                            </a>
                          </div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="rounded-lg border p-3 bg-muted/20">
                    <div className="text-xs text-muted-foreground">Total Folders</div>
                    <div className="text-lg font-bold">{driveStatus.data?.stats?.totalFolders ?? 0}</div>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/20">
                    <div className="text-xs text-muted-foreground">Bill Folders</div>
                    <div className="text-lg font-bold text-primary">{driveStatus.data?.stats?.totalBillFolders ?? 0}</div>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/20">
                    <div className="text-xs text-muted-foreground">Total Files</div>
                    <div className="text-lg font-bold">{driveStatus.data?.stats?.totalFiles ?? 0}</div>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/20">
                    <div className="text-xs text-muted-foreground">Annexure Files</div>
                    <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                      {driveStatus.data?.stats?.annexureCandidates ?? 0}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/20">
                    <div className="text-xs text-muted-foreground">Processed Files</div>
                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {driveStatus.data?.stats?.annexuresProcessed ?? 0}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/20">
                    <div className="text-xs text-muted-foreground">Extracted Rows</div>
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {driveStatus.data?.stats?.totalRowsExtracted ?? 0}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Modular Connected Root Drive Folders Card */}
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-base">Connected Root Google Drive Folders</CardTitle>
                <CardDescription className="text-xs">
                  Modular Google Drive Root Folders scanned for Bill Annexures. You can add root folders for different financial years or teams.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* List of Connected Roots */}
                <div className="overflow-x-auto rounded-lg border">
                  <Table className="text-xs">
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="py-2 font-bold">Drive Folder Name</TableHead>
                        <TableHead className="py-2 font-bold">Folder ID</TableHead>
                        <TableHead className="py-2 font-bold">Financial Year</TableHead>
                        <TableHead className="py-2 font-bold text-center">Status</TableHead>
                        <TableHead className="py-2 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(driveStatus.data?.roots || []).map((root) => (
                        <TableRow key={root.folderId}>
                          <TableCell className="font-semibold">{root.name}</TableCell>
                          <TableCell className="font-mono text-muted-foreground">{root.folderId}</TableCell>
                          <TableCell><Badge variant="outline">{root.financialYear || "—"}</Badge></TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">Active</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                              disabled={deleteRootMutation.isPending}
                              onClick={() => deleteRootMutation.mutate(root.folderId)}
                            >
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(driveStatus.data?.roots || []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="py-4 text-center text-muted-foreground">
                            No root folders configured.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Add New Root Form */}
                <div className="p-4 rounded-lg border bg-muted/20 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">+ Add New Google Drive Root Folder</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <Input
                        placeholder="Paste Google Drive Folder URL or Folder ID (e.g. https://drive.google.com/drive/folders/1blzU74aht...)"
                        value={newRootUrl}
                        onChange={(e) => setNewRootUrl(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <Input
                        placeholder="Folder Name (e.g. All Bill 2025-26)"
                        value={newRootName}
                        onChange={(e) => setNewRootName(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="w-48">
                      <Input
                        placeholder="Financial Year (e.g. 2025-26)"
                        value={newRootFy}
                        onChange={(e) => setNewRootFy(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <Button
                      size="sm"
                      className="text-xs"
                      disabled={!newRootUrl.trim() || addRootMutation.isPending}
                      onClick={() =>
                        addRootMutation.mutate({
                          folderUrl: newRootUrl.trim(),
                          name: newRootName.trim() || undefined,
                          financialYear: newRootFy.trim() || undefined,
                        })
                      }
                    >
                      {addRootMutation.isPending ? "Adding Drive…" : "+ Add Drive Folder"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">Extracted Annexure Database Records</CardTitle>
                    <CardDescription>
                      Structured rows extracted from Excel Annexure files in Google Drive bill folders.
                    </CardDescription>
                  </div>
                  <div className="w-full sm:w-72">
                    <Input
                      placeholder="Search bill no, vehicle, invoice, file..."
                      value={annexureSearch}
                      onChange={(e) => {
                        setAnnexureSearch(e.target.value);
                        setAnnexurePage(1);
                      }}
                      className="text-xs"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {annexuresQuery.isLoading ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">Loading annexure records…</div>
                ) : annexuresQuery.isError ? (
                  <div className="py-8 text-center text-xs text-destructive">
                    {getApiErrorMessage(annexuresQuery.error)}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-lg border">
                      <Table className="text-xs">
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="py-2">Bill No</TableHead>
                            <TableHead className="py-2">Vehicle No</TableHead>
                            <TableHead className="py-2">Invoice No</TableHead>
                            <TableHead className="py-2">Delivery No</TableHead>
                            <TableHead className="py-2">LR No</TableHead>
                            <TableHead className="py-2">Consignor / Consignee</TableHead>
                            <TableHead className="py-2 text-right">Freight Base</TableHead>
                            <TableHead className="py-2 text-right">Total Amt</TableHead>
                            <TableHead className="py-2">Source File</TableHead>
                            <TableHead className="py-2 text-center">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(annexuresQuery.data?.records || []).map((rec) => (
                            <TableRow key={rec.annexureKey || rec._id} className="align-top">
                              <TableCell className="font-semibold">{rec.billNumber || "—"}</TableCell>
                              <TableCell className="font-mono font-medium">{rec.vehicleNumber || "—"}</TableCell>
                              <TableCell>{rec.invoiceNumber || "—"}</TableCell>
                              <TableCell>{rec.deliveryNumber || "—"}</TableCell>
                              <TableCell>{rec.lrNumber || "—"}</TableCell>
                              <TableCell>
                                <div className="max-w-[180px] truncate" title={`${rec.consignorName || ''} -> ${rec.consigneeName || ''}`}>
                                  {rec.consignorName ? <span className="font-medium">{rec.consignorName}</span> : null}
                                  {rec.consigneeName ? <span className="text-muted-foreground"> → {rec.consigneeName}</span> : null}
                                  {!rec.consignorName && !rec.consigneeName ? "—" : null}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {rec.freightBaseAmount ? `₹${rec.freightBaseAmount.toLocaleString("en-IN")}` : "—"}
                              </TableCell>
                              <TableCell className="text-right font-medium text-emerald-600 dark:text-emerald-400">
                                {rec.totalAmount ? `₹${rec.totalAmount.toLocaleString("en-IN")}` : "—"}
                              </TableCell>
                              <TableCell className="max-w-[150px] truncate" title={rec.fileName}>
                                {rec.fileName}
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[11px]"
                                  onClick={() => setSelectedRawRecord(rec)}
                                >
                                  View Raw
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                          {(annexuresQuery.data?.records || []).length === 0 && (
                            <TableRow>
                              <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                                {annexureSearch
                                  ? `No annexure records matching "${annexureSearch}"`
                                  : "No extracted annexure records found in database. Click 'Scan Drive & Extract Annexures Now' to run scanner."}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    {(annexuresQuery.data?.totalPages ?? 0) > 1 && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div>
                          Showing page {annexuresQuery.data?.page} of {annexuresQuery.data?.totalPages} ({annexuresQuery.data?.total} total rows)
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={annexurePage <= 1}
                            onClick={() => setAnnexurePage((p) => Math.max(1, p - 1))}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={annexurePage >= (annexuresQuery.data?.totalPages ?? 1)}
                            onClick={() => setAnnexurePage((p) => p + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Raw JSON Modal Dialog */}
            <AlertDialog open={!!selectedRawRecord} onOpenChange={(open) => (!open ? setSelectedRawRecord(null) : undefined)}>
              <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-base font-bold">
                    Annexure Raw Data & Header Mapping
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-xs">
                    File: <span className="font-semibold text-foreground">{selectedRawRecord?.fileName}</span> (Row {selectedRawRecord?.rowNumber})
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4 text-xs my-2">
                  <div>
                    <h4 className="font-semibold text-muted-foreground mb-1">Header Mapping Used:</h4>
                    <pre className="bg-muted p-2 rounded text-[11px] overflow-x-auto">
                      {JSON.stringify(selectedRawRecord?.headerMapping || {}, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <h4 className="font-semibold text-muted-foreground mb-1">Raw Excel Row Data:</h4>
                    <pre className="bg-muted p-2 rounded text-[11px] overflow-x-auto">
                      {JSON.stringify(selectedRawRecord?.raw || {}, null, 2)}
                    </pre>
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogAction onClick={() => setSelectedRawRecord(null)}>Close</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
