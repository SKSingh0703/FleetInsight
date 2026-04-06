export type Summary = {
  totalTrips: number;
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
};

export type ApiTrip = {
  _id?: string;
  tripKey?: string;
  sno?: string;
  invoiceNumber?: string;
  deliveryNumber?: string;
  chassisNumber?: string;
  vehicleNumber?: string;
  vehicleSuffix?: string;
  tripType: "OWN" | "MARKET";
  tripNumber?: string;
  marketVehicleBookNumber?: string;
  partyType: "TPT" | "LOGISTICS" | "OTHER";
  partyName?: string;
  loadingDate?: string;
  unloadingDate?: string;
  challanDate?: string;
  loadingPoint?: string;
  unloadingPoint?: string;
  loadingWeightTons?: number;
  unloadingWeightTons?: number;
  shortageTons?: number;
  ratePerTon?: number;
  totalFreight?: number;
  cash?: number;
  cardAccount?: string;
  cashDate?: string;
  diesel?: number;
  pumpCard?: string;
  dieselDate?: string;
  fastag?: number;
  fastagDate?: string;
  totalAdvance?: number;
  otherExpenses?: number;
  billBookNumber?: string;
  marketPaymentDate?: string;
  remarks?: string;
  tripStatus?: string;
  sheet?: {
    spreadsheetId?: string;
    tabName?: string;
    rowNumber?: number;
    raw?: Record<string, unknown>;
  };
  computed?: {
    revenue?: number;
    shortageTons?: number;
    shortageCost?: number;
    totalExpenses?: number;
    profit?: number;
  };
};

export type SearchFilters = {
  tripKey?: string;
  vehicleNumber?: string;
  invoiceNumber?: string;
  deliveryNumber?: string;
  tripNumber?: string;
  chassisNumber?: string;
  bookNumber?: string;
  partyName?: string;
  party?: string;
  loadingPoint?: string;
  unloadingPoint?: string;
  tripType?: "OWN" | "MARKET" | "";
  partyType?: "TPT" | "LOGISTICS" | "OTHER" | "";
  tripDateRange?: { from?: string; to?: string };
  dateRange?: { from?: string; to?: string };
  unloadingDateRange?: { from?: string; to?: string };
  month?: number;
  year?: number;
  limit?: number;
  skip?: number;
};

export type SearchResponse = {
  summary: Summary;
  trips: ApiTrip[];
};

export type UploadResponse = {
  message: string;
  file: {
    originalName: string;
    mimeType: string;
    size: number;
    filename: string;
    path: string;
  };
  summary: {
    rawRows: number;
    processedTrips: number;
    rejectedRows: number;
    duplicateInvoiceNumbers: number;
  };
  storage: {
    requested: number;
    upserted: number;
    modified: number;
    matched: number;
  };
  errorRows: Array<{
    sheetName: string;
    rowNumber: number;
    invoiceNumber?: string;
    tripKey?: string;
    issues: string[];
    raw?: Record<string, unknown>;
  }>;
};

export type SheetIntegration = {
  _id?: string;
  enabled: boolean;
  spreadsheetId: string;
  autoDiscoverTabs?: boolean;
  defaultRange?: string;
  defaultHeaderRow?: number;
  syncIntervalSeconds?: number;
  tabs?: Array<{ tabName: string; range?: string; headerRow?: number }>;
  createdAt?: string;
  updatedAt?: string;
};

export type SheetTabSyncState = {
  _id?: string;
  spreadsheetId: string;
  tabName: string;
  lastRunAt?: string;
  lastError?: string;
  lastStats?: {
    processed?: number;
    changed?: number;
    skippedEmpty?: number;
    skippedIncomplete?: number;
    rejected?: number;
    upsertRequested?: number;
    upsertMatched?: number;
    upsertModified?: number;
    upsertUpserted?: number;
  };
};

export type SheetSyncRun = {
  _id?: string;
  spreadsheetId: string;
  startedAt: string;
  finishedAt?: string;
  status: "RUNNING" | "SUCCESS" | "FAILED" | "SKIPPED";
  message?: string;
  results?: Array<{
    tabName: string;
    processed: number;
    changed: number;
    skippedEmpty: number;
    skippedIncomplete: number;
    rejected: number;
    upsert: { requested: number; matched: number; modified: number; upserted: number };
  }>;
};

export type UiTrip = {
  id: string;
  tripKey: string;
  invoiceNumber: string;
  bookNumber: string;
  chassisNumber: string;
  vehicleNumber: string;
  date: string;
  loadingDate: string;
  unloadingDate: string;
  loadingPoint: string;
  unloadingPoint: string;
  tripType: "OWN" | "MARKET";
  partyType: "TPT" | "LOGISTICS" | "OTHER";
  partyName: string;
  loadingWeightTons: number;
  unloadingWeightTons: number;
  shortageTons: number;
  weight: number;
  rate: number;
  totalFreight: number;
  income: number;
  diesel: number;
  toll: number;
  driverBhatta: number;
  otherExpenses: number;
  totalExpenses: number;
  profit: number;
  raw?: ApiTrip;
};

export type VehicleSummary = {
  vehicleNumber: string;
  totalTrips: number;
  totalIncome: number;
  totalExpenses: number;
  profit: number;
};

export type AuthUser = {
  id: string;
  name?: string;
  email: string;
  role: "ADMIN" | "USER";
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt?: string;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

const DEFAULT_BASE_URL = "http://localhost:5000";

const AUTH_TOKEN_KEY = "fleetinsight_token";

export const AUTH_EXPIRED_EVENT = "fleetinsight:auth-expired";

function emitAuthExpired() {
  try {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  } catch {
    // ignore
  }
}

export function getAuthToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setAuthToken(token: string) {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // ignore
  }
}

function getBaseUrl() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fromEnv = (import.meta as any)?.env?.VITE_API_URL;
  const host = typeof window !== "undefined" ? window.location.hostname : "";

  const g = globalThis as unknown as { __fleetinsight_baseurl_logged?: boolean };

  if (!g.__fleetinsight_baseurl_logged) {
    g.__fleetinsight_baseurl_logged = true;
    console.log("[fleetinsight] api baseUrl debug", {
      VITE_API_URL: fromEnv,
      hostname: host,
    });
  }

  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();

  const isLocalHost = host === "localhost" || host === "127.0.0.1";
  return isLocalHost ? DEFAULT_BASE_URL : "";
}

export class ApiError extends Error {
  status?: number;
  bodyText?: string;
  isNetworkError?: boolean;

  constructor(message: string, opts?: { status?: number; bodyText?: string; isNetworkError?: boolean }) {
    super(message);
    this.name = "ApiError";
    this.status = opts?.status;
    this.bodyText = opts?.bodyText;
    this.isNetworkError = opts?.isNetworkError;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  let res: Response;
  try {
    res = await fetch(`${getBaseUrl()}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers || {}),
      },
    });
  } catch (err) {
    const msg = typeof err?.message === "string" ? err.message : "Network error";
    throw new ApiError(msg || "Network error", { isNetworkError: true });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401) {
      setAuthToken("");
      emitAuthExpired();
      throw new ApiError("Session expired. Please sign in again.", { status: 401, bodyText: text });
    }
    const message = text || `Request failed: ${res.status}`;
    throw new ApiError(message, { status: res.status, bodyText: text });
  }

  return res.json() as Promise<T>;
}

function toIsoDateOnly(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function toUiTrip(t: ApiTrip): UiTrip {
  const unloadingDate = toIsoDateOnly(t.unloadingDate);
  const loadingDate = toIsoDateOnly(t.loadingDate);
  const date = unloadingDate || loadingDate;

  const loadingWeightTons = Number(t.loadingWeightTons ?? 0);
  const unloadingWeightTons = Number(t.unloadingWeightTons ?? 0);
  const shortageTons = Number(
    t.shortageTons ??
      t.computed?.shortageTons ??
      (Number.isFinite(loadingWeightTons) && Number.isFinite(unloadingWeightTons) ? loadingWeightTons - unloadingWeightTons : 0),
  );

  const hasExplicitTotalFreight = typeof t.totalFreight === "number" && Number.isFinite(t.totalFreight) && t.totalFreight > 0;
  const totalFreight = Number(
    hasExplicitTotalFreight
      ? t.totalFreight
      : t.computed?.revenue ??
        (Number.isFinite(unloadingWeightTons) ? unloadingWeightTons * Number(t.ratePerTon ?? 0) : 0),
  );

  const income = Number(t.computed?.revenue ?? 0);
  const diesel = Number(t.diesel ?? 0);
  const otherExpenses = Number((t.cash ?? 0) + (t.otherExpenses ?? 0));
  const totalExpenses = Number(t.computed?.totalExpenses ?? diesel + otherExpenses);
  const profit = Number(t.computed?.profit ?? income - totalExpenses);

  return {
    id: t._id || t.tripKey || t.invoiceNumber,
    tripKey: t.tripKey || "",
    invoiceNumber: t.invoiceNumber || "",
    bookNumber: t.marketVehicleBookNumber || "",
    chassisNumber: t.chassisNumber || "",
    vehicleNumber: t.vehicleNumber || "",
    date,
    loadingDate,
    unloadingDate,
    loadingPoint: t.loadingPoint || "",
    unloadingPoint: t.unloadingPoint || "",
    tripType: t.tripType,
    partyType: t.partyType,
    partyName: t.partyName || "UNKNOWN",
    loadingWeightTons,
    unloadingWeightTons,
    shortageTons,
    weight: unloadingWeightTons,
    rate: Number(t.ratePerTon ?? 0),
    totalFreight,
    income: totalFreight,
    diesel,
    toll: 0,
    driverBhatta: 0,
    otherExpenses,
    totalExpenses,
    profit,
    raw: t,
  };
}

export function buildVehicleSummaries(trips: UiTrip[]): VehicleSummary[] {
  const map = new Map<string, VehicleSummary>();

  for (const t of trips) {
    const existing = map.get(t.vehicleNumber);
    if (existing) {
      existing.totalTrips += 1;
      existing.totalIncome += t.income;
      existing.totalExpenses += t.totalExpenses;
      existing.profit += t.profit;
    } else {
      map.set(t.vehicleNumber, {
        vehicleNumber: t.vehicleNumber,
        totalTrips: 1,
        totalIncome: t.income,
        totalExpenses: t.totalExpenses,
        profit: t.profit,
      });
    }
  }

  return Array.from(map.values());
}

export function postSearch(filters: SearchFilters, signal?: AbortSignal): Promise<SearchResponse> {
  return requestJson<SearchResponse>("/api/search", {
    method: "POST",
    body: JSON.stringify(filters || {}),
    ...(signal ? { signal } : {}),
  });
}

export function getDashboard(
  opts?: { month?: number; year?: number; limit?: number; signal?: AbortSignal }
): Promise<{ summary: Summary; trips: ApiTrip[] }> {
  const month = typeof opts?.month === "number" ? opts.month : undefined;
  const year = typeof opts?.year === "number" ? opts.year : undefined;
  const limit = typeof opts?.limit === "number" ? opts.limit : undefined;

  const qs = new URLSearchParams();
  if (typeof month === "number") qs.set("month", String(month));
  if (typeof year === "number") qs.set("year", String(year));
  if (typeof limit === "number") qs.set("limit", String(limit));

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return requestJson<{ summary: Summary; trips: ApiTrip[] }>(`/api/dashboard${suffix}`, {
    method: "GET",
    ...(opts?.signal ? { signal: opts.signal } : {}),
  });
}

export function uploadFile(
  file: File,
  opts?: { onProgress?: (percent: number) => void; signal?: AbortSignal }
): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${getBaseUrl()}/api/upload`);

    const token = getAuthToken();
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    xhr.upload.onprogress = (evt) => {
      if (!opts?.onProgress) return;
      if (!evt.lengthComputable) return;
      const percent = Math.round((evt.loaded / evt.total) * 100);
      opts.onProgress(percent);
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== XMLHttpRequest.DONE) return;
      if (xhr.status === 401) {
        setAuthToken("");
        emitAuthExpired();
      }
    };

    xhr.onload = () => {
      try {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(xhr.responseText || `Upload failed: ${xhr.status}`));
          return;
        }
        resolve(JSON.parse(xhr.responseText) as UploadResponse);
      } catch (e) {
        reject(e);
      }
    };

    xhr.onerror = () => reject(new Error("Network error"));

    if (opts?.signal) {
      const onAbort = () => {
        xhr.abort();
        reject(new Error("Upload aborted"));
      };
      if (opts.signal.aborted) return onAbort();
      opts.signal.addEventListener("abort", onAbort, { once: true });
    }

    xhr.send(form);
  });
}

export function postAuthGoogle(credential: string): Promise<AuthResponse> {
  return requestJson<AuthResponse>("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
}

export function getPartyOptions(signal?: AbortSignal): Promise<{ options: string[] }> {
  return requestJson<{ options: string[] }>("/api/party-options", {
    method: "GET",
    ...(signal ? { signal } : {}),
  });
}

export function getPartyNameOptions(signal?: AbortSignal): Promise<{ options: string[] }> {
  return requestJson<{ options: string[] }>("/api/party-name-options", {
    method: "GET",
    ...(signal ? { signal } : {}),
  });
}

export function getLoadingPointOptions(signal?: AbortSignal): Promise<{ options: string[] }> {
  return requestJson<{ options: string[] }>("/api/loading-point-options", {
    method: "GET",
    ...(signal ? { signal } : {}),
  });
}

export function getUnloadingPointOptions(signal?: AbortSignal): Promise<{ options: string[] }> {
  return requestJson<{ options: string[] }>("/api/unloading-point-options", {
    method: "GET",
    ...(signal ? { signal } : {}),
  });
}

export function getChassisNumberOptions(signal?: AbortSignal): Promise<{ options: string[] }> {
  return requestJson<{ options: string[] }>("/api/chassis-number-options", {
    method: "GET",
    ...(signal ? { signal } : {}),
  });
}

export function getBookNumberOptions(signal?: AbortSignal): Promise<{ options: string[] }> {
  return requestJson<{ options: string[] }>("/api/book-number-options", {
    method: "GET",
    ...(signal ? { signal } : {}),
  });
}

export function getMe(): Promise<{ user: AuthUser }> {
  return requestJson<{ user: AuthUser }>("/api/auth/me", { method: "GET" });
}

export function adminListUsers(): Promise<{ users: AuthUser[] }> {
  return requestJson<{ users: AuthUser[] }>("/api/admin/users", { method: "GET" });
}

export function adminListPending(): Promise<{ users: AuthUser[] }> {
  return requestJson<{ users: AuthUser[] }>("/api/admin/pending", { method: "GET" });
}

export function adminApproveUser(userId: string): Promise<{ user: AuthUser }> {
  return requestJson<{ user: AuthUser }>(`/api/admin/approve/${encodeURIComponent(userId)}`, {
    method: "POST",
  });
}

export function adminRejectUser(userId: string): Promise<{ user: AuthUser }> {
  return requestJson<{ user: AuthUser }>(`/api/admin/reject/${encodeURIComponent(userId)}`, {
    method: "POST",
  });
}

export function adminMakeAdmin(userId: string): Promise<{ user: AuthUser }> {
  return requestJson<{ user: AuthUser }>(`/api/admin/make-admin/${encodeURIComponent(userId)}`, {
    method: "POST",
  });
}

export function adminRemoveUser(userId: string): Promise<{ removed: boolean }> {
  return requestJson<{ removed: boolean }>(`/api/admin/remove/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

export function adminDeleteTrip(tripId: string): Promise<{ message: string }> {
  return requestJson<{ message: string }>(`/api/trips/${encodeURIComponent(tripId)}`, {
    method: "DELETE",
  });
}

export function adminGetSheetSyncStatus(): Promise<{
  integration: SheetIntegration | null;
  states: SheetTabSyncState[];
  runs: SheetSyncRun[];
}> {
  return requestJson<{ integration: SheetIntegration | null; states: SheetTabSyncState[]; runs: SheetSyncRun[] }>(
    "/api/admin/sheetsync",
    { method: "GET" }
  );
}

export function adminSuggestSheetSyncTabs(spreadsheetId: string): Promise<{
  tabs: string[];
  suggested: { current: string | null; previous: string | null; meta?: unknown };
}> {
  return requestJson<{ tabs: string[]; suggested: { current: string | null; previous: string | null; meta?: unknown } }>(
    `/api/admin/sheetsync/suggest?spreadsheetId=${encodeURIComponent(spreadsheetId)}`,
    { method: "GET" }
  );
}

export function adminUpsertSheetSyncConfig(payload: {
  enabled: boolean;
  spreadsheetId: string;
  autoDiscoverTabs: boolean;
  syncIntervalSeconds: number;
  defaultRange: string;
  defaultHeaderRow: number;
  tabs: Array<{ tabName: string; range?: string; headerRow?: number }>;
}): Promise<{ integration: SheetIntegration }> {
  return requestJson<{ integration: SheetIntegration }>("/api/admin/sheetsync/config", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function adminRunSheetSyncNow(): Promise<{ result: unknown }> {
  return requestJson<{ result: unknown }>("/api/admin/sheetsync/run", { method: "POST" });
}

export function adminListSheetSyncRuns(): Promise<{ runs: SheetSyncRun[] }> {
  return requestJson<{ runs: SheetSyncRun[] }>("/api/admin/sheetsync/runs", { method: "GET" });
}

export function getDeliveryNumberOptions(signal?: AbortSignal): Promise<{ options: string[] }> {
  return requestJson<{ options: string[] }>("/api/delivery-number-options", { method: "GET", signal });
}

export function getTripNumberOptions(signal?: AbortSignal): Promise<{ options: string[] }> {
  return requestJson<{ options: string[] }>("/api/trip-number-options", { method: "GET", signal });
}
