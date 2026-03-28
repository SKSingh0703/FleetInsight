export type Summary = {
  totalTrips: number;
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
};

export type ApiLocation = {
  name?: string;
};

export type ApiMovement = {
  date: string;
  location?: ApiLocation;
  weightTons: number;
};

export type ApiTrip = {
  _id?: string;
  tripKey?: string;
  invoiceNumber?: string;
  chassisNumber: string;
  vehicleNumber: string;
  vehicleSuffix?: string;
  tripType: "OWN" | "MARKET";
  bookNumber?: string;
  partyType: "TPT" | "LOGISTICS" | "OTHER";
  partyName?: string;
  loading: ApiMovement;
  unloading: ApiMovement;
  ratePerTon: number;
  expenses?: {
    cash?: number;
    diesel?: number;
    other?: number;
  };
  extensions?: Record<string, unknown>;
  sheet?: {
    sheetName?: string;
    rowNumber?: number;
    raw?: Record<string, unknown>;
    normalized?: Record<string, unknown>;
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
  chassisNumber?: string;
  bookNumber?: string;
  partyName?: string;
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

const DEFAULT_BASE_URL = "http://localhost:5000";

function getBaseUrl() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fromEnv = (import.meta as any)?.env?.VITE_API_URL;
  return typeof fromEnv === "string" && fromEnv.trim() ? fromEnv.trim() : DEFAULT_BASE_URL;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
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
  const unloadingDate = toIsoDateOnly(t.unloading?.date);
  const loadingDate = toIsoDateOnly(t.loading?.date);
  const date = unloadingDate || loadingDate;

  const loadingWeightTons = Number(t.loading?.weightTons ?? 0);
  const unloadingWeightTons = Number(t.unloading?.weightTons ?? 0);
  const shortageTons = Number(
    t.computed?.shortageTons ??
      (Number.isFinite(loadingWeightTons) && Number.isFinite(unloadingWeightTons) ? loadingWeightTons - unloadingWeightTons : 0),
  );

  const totalFreight = Number(
    t.computed?.revenue ??
      (Number.isFinite(unloadingWeightTons) ? unloadingWeightTons * Number(t.ratePerTon ?? 0) : 0),
  );

  const income = Number(t.computed?.revenue ?? 0);
  const diesel = Number(t.expenses?.diesel ?? 0);
  const otherExpenses = Number((t.expenses?.cash ?? 0) + (t.expenses?.other ?? 0));
  const totalExpenses = Number(t.computed?.totalExpenses ?? diesel + otherExpenses);
  const profit = Number(t.computed?.profit ?? income - totalExpenses);

  return {
    id: t._id || t.tripKey || t.invoiceNumber,
    tripKey: t.tripKey || "",
    invoiceNumber: t.invoiceNumber || "",
    bookNumber: t.bookNumber || "",
    chassisNumber: t.chassisNumber || "",
    vehicleNumber: t.vehicleNumber || "",
    date,
    loadingDate,
    unloadingDate,
    loadingPoint: t.loading?.location?.name || "",
    unloadingPoint: t.unloading?.location?.name || "",
    tripType: t.tripType,
    partyType: t.partyType,
    partyName: t.partyName || "UNKNOWN",
    loadingWeightTons,
    unloadingWeightTons,
    shortageTons,
    weight: Number(t.unloading?.weightTons ?? 0),
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

export function postSearch(filters: SearchFilters): Promise<SearchResponse> {
  return requestJson<SearchResponse>("/api/search", {
    method: "POST",
    body: JSON.stringify(filters || {}),
  });
}

export function getDashboard() {
  return requestJson<{ summary: Summary; trips: ApiTrip[] }>("/api/dashboard", { method: "GET" });
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

    xhr.upload.onprogress = (evt) => {
      if (!opts?.onProgress) return;
      if (!evt.lengthComputable) return;
      const percent = Math.round((evt.loaded / evt.total) * 100);
      opts.onProgress(percent);
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
