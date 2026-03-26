const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

async function jsonResponse(res) {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Unexpected response type: ${contentType}`);
  }
  return res.json();
}

export async function uploadFile(file) {
  // Phase 1+ will call POST /api/upload with multipart/form-data.
  throw new Error("uploadFile not implemented yet");
}

export async function fetchVehicle(vehicleNumber) {
  // Phase 3+ will call GET /api/vehicle/:vehicleNumber.
  throw new Error("fetchVehicle not implemented yet");
}

export async function fetchDashboard() {
  // Phase 3+ will call GET /api/dashboard.
  throw new Error("fetchDashboard not implemented yet");
}

export { API_BASE, jsonResponse };

